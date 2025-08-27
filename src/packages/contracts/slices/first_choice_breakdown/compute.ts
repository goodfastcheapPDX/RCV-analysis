import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { getArtifactPaths } from "../../lib/artifact-paths.js";
import {
  assertManifestSection,
  assertTableColumns,
  parseAllRows,
  sha256,
} from "../../lib/contract-enforcer.js";
import {
  Data,
  type FirstChoiceBreakdownOutput,
  Output,
  SQL_QUERIES,
  Stats,
  version,
} from "./index.contract.js";

interface ManifestEntry {
  files: string[];
  hashes: Record<string, string>;
  stats: Stats;
  data: Data;
  datasetVersion: string;
}

export async function computeFirstChoiceBreakdown(): Promise<FirstChoiceBreakdownOutput> {
  const paths = getArtifactPaths();

  // Verify input file exists
  if (!existsSync(paths.ingest.ballotsLong)) {
    throw new Error(
      `Input file not found: ${paths.ingest.ballotsLong}. Run ingest_cvr first.`,
    );
  }

  // Create database instance
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run("BEGIN TRANSACTION");

    // Step 1: Create view from existing ballots_long parquet
    console.log("Creating ballots_long view...");
    await conn.run(
      `CREATE OR REPLACE VIEW ballots_long AS SELECT * FROM '${paths.ingest.ballotsLong}';`,
    );

    // Step 2: Ensure output directory exists
    mkdirSync(dirname(paths.summary.firstChoice), { recursive: true });

    // Step 3: Create temporary table for validation
    console.log("Computing first choice breakdown...");
    await conn.run(SQL_QUERIES.exportFirstChoice);

    // Step 4: ENFORCE CONTRACT - Validate schema before exporting
    console.log("Enforcing contract: validating table schema...");
    await assertTableColumns(conn, "first_choice_breakdown", Output);

    // Step 5: ENFORCE CONTRACT - Validate all data through Zod
    console.log("Enforcing contract: validating all rows...");
    const validatedRows = await parseAllRows(
      conn,
      "first_choice_breakdown",
      Output,
    );

    if (validatedRows.length === 0) {
      throw new Error("No valid rows found in first_choice_breakdown table");
    }

    // Step 6: Derive stats from validated data (not from separate SQL)
    const stats: Stats = {
      total_valid_ballots: validatedRows.reduce(
        (sum, row) => sum + row.first_choice_votes,
        0,
      ),
      candidate_count: validatedRows.length,
      sum_first_choice: validatedRows.reduce(
        (sum, row) => sum + row.first_choice_votes,
        0,
      ),
    };

    const data: Data = {
      rows: validatedRows.length,
    };

    // Validate stats through Zod schema
    const validatedStats = Stats.parse(stats);
    const validatedData = Data.parse(data);

    // Step 7: Export to parquet after contract validation
    console.log("Exporting validated data to parquet...");
    await conn.run(
      `COPY first_choice_breakdown TO '${paths.summary.firstChoice}' (FORMAT 'parquet');`,
    );

    await conn.run("COMMIT");

    // Step 8: Calculate file hash using contract enforcer
    const fileHash = sha256(paths.summary.firstChoice);

    const parsedResult: FirstChoiceBreakdownOutput = {
      stats: validatedStats,
      data: validatedData,
    };

    // Step 9: Update manifest.json
    let manifest: Record<string, ManifestEntry> = {};

    if (existsSync(paths.manifest)) {
      try {
        manifest = JSON.parse(readFileSync(paths.manifest, "utf8"));
      } catch (_error) {
        console.warn(
          `Could not parse existing ${paths.manifest}, creating new one`,
        );
      }
    }

    const manifestKey = `first_choice_breakdown@${version}`;
    manifest[manifestKey] = {
      files: [paths.summary.firstChoice],
      hashes: {
        [paths.summary.firstChoice]: fileHash,
      },
      stats: parsedResult.stats,
      data: parsedResult.data,
      datasetVersion: version,
    };

    writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));

    // Step 10: ENFORCE CONTRACT - Validate manifest section
    console.log("Enforcing contract: validating manifest section...");
    assertManifestSection(paths.manifest, manifestKey, Stats);

    console.log(`First choice breakdown completed:`);
    console.log(
      `- Total valid ballots: ${parsedResult.stats.total_valid_ballots}`,
    );
    console.log(`- Candidates: ${parsedResult.stats.candidate_count}`);
    console.log(`- Output rows: ${parsedResult.data.rows}`);
    console.log(`- File hash: ${fileHash.substring(0, 16)}...`);

    return parsedResult;
  } catch (error) {
    try {
      await conn.run("ROLLBACK");
    } catch {
      // Ignore rollback errors
    }
    throw error;
  } finally {
    await conn.closeSync();
  }
}
