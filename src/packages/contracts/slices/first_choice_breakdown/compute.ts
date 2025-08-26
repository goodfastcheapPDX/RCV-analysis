import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname } from "path";
import { mkdirSync } from "fs";
import {
  FirstChoiceBreakdownOutput,
  FirstChoiceBreakdownOutputSchema,
  Output,
  Stats,
  Data,
  version,
  SQL_QUERIES,
} from "./index.contract.js";
import {
  parseAllRows,
  assertTableColumns,
  assertManifestSection,
  sha256,
  preprocessDuckDBRow,
} from "../../lib/contract-enforcer.js";

interface ManifestEntry {
  files: string[];
  hashes: Record<string, string>;
  stats: Stats;
  data: Data;
  datasetVersion: string;
}

export async function computeFirstChoiceBreakdown(): Promise<FirstChoiceBreakdownOutput> {
  // Verify input file exists
  const inputPath = "data/ingest/ballots_long.parquet";
  if (!existsSync(inputPath)) {
    throw new Error(
      `Input file not found: ${inputPath}. Run ingest_cvr first.`,
    );
  }

  // Create database instance
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run("BEGIN TRANSACTION");

    // Step 1: Create view from existing ballots_long parquet
    console.log("Creating ballots_long view...");
    await conn.run(SQL_QUERIES.createFirstChoiceView);

    // Step 2: Ensure output directory exists
    mkdirSync("data/summary", { recursive: true });

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
    await conn.run(SQL_QUERIES.copyToParquet);

    await conn.run("COMMIT");

    // Step 8: Calculate file hash using contract enforcer
    const outputPath = "data/summary/first_choice.parquet";
    const fileHash = sha256(outputPath);

    const parsedResult: FirstChoiceBreakdownOutput = {
      stats: validatedStats,
      data: validatedData,
    };

    // Step 9: Update manifest.json
    const manifestPath = "manifest.json";
    let manifest: Record<string, ManifestEntry> = {};

    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch (error) {
        console.warn(
          "Could not parse existing manifest.json, creating new one",
        );
      }
    }

    const manifestKey = `first_choice_breakdown@${version}`;
    manifest[manifestKey] = {
      files: ["data/summary/first_choice.parquet"],
      hashes: {
        "data/summary/first_choice.parquet": fileHash,
      },
      stats: parsedResult.stats,
      data: parsedResult.data,
      datasetVersion: version,
    };

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Step 10: ENFORCE CONTRACT - Validate manifest section
    console.log("Enforcing contract: validating manifest section...");
    assertManifestSection(manifestPath, manifestKey, Stats);

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
