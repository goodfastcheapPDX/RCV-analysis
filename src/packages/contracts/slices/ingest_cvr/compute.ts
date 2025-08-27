import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { getArtifactPaths } from "../../lib/artifact-paths.js";
import {
  CONTRACT_VERSION,
  type IngestCvrOutput,
  IngestCvrOutputSchema,
  SQL_QUERIES,
} from "./index.contract.js";

interface ManifestEntry {
  files: string[];
  hashes: Record<string, string>;
  rows: number;
  min_rank: number;
  max_rank: number;
  duplicate_ballots: number;
  datasetVersion: string;
}

export async function ingestCvr(): Promise<IngestCvrOutput> {
  const srcCsv = process.env.SRC_CSV;
  if (!srcCsv) {
    throw new Error("SRC_CSV environment variable is required");
  }

  const paths = getArtifactPaths();
  const dbPath = "data/working/election.duckdb";

  // Ensure database directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  // Create database instance
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run("BEGIN TRANSACTION");

    // Step 1: Load raw CSV data
    console.log("Loading raw CSV data...");
    await conn.run(SQL_QUERIES.createRawTable(srcCsv));

    // Step 2: Create candidates table
    console.log("Creating candidates table...");
    await conn.run(SQL_QUERIES.createCandidatesTable);

    // Step 3: Create candidate columns mapping table
    console.log("Creating candidate columns mapping...");
    await conn.run(SQL_QUERIES.createCandidateColumnsTable);

    // Step 4: Generate UNION ALL query for ballots_long
    console.log("Generating ballots_long normalization query...");
    const candidateColumnsResult = await conn.run(
      "SELECT column_name FROM candidate_columns",
    );
    const candidateColumns = await candidateColumnsResult.getRowObjects();

    if (!candidateColumns || candidateColumns.length === 0) {
      throw new Error("No candidate columns found. Check CSV header format.");
    }

    const unionQueries = candidateColumns.map((row) => {
      const columnName = row.column_name as string;
      return `SELECT BallotID, PrecinctID, BallotStyleID, '${columnName}' AS column_name, CAST("${columnName}" AS INTEGER) AS has_vote FROM rcv_raw WHERE Status=0 AND "${columnName}"=1`;
    });

    const unionAllQuery = unionQueries.join(" UNION ALL ");
    const finalBallotsLongQuery = SQL_QUERIES.createBallotsLongTable.replace(
      "__UNION_ALL_PLACEHOLDER__",
      unionAllQuery,
    );

    // Step 5: Create ballots_long table
    console.log("Creating ballots_long table...");
    await conn.run(finalBallotsLongQuery);

    // Step 6: Export to Arrow format
    console.log("Exporting candidates to Arrow format...");
    mkdirSync(dirname(paths.ingest.candidates), { recursive: true });
    await conn.run(
      `COPY candidates TO '${paths.ingest.candidates}' (FORMAT PARQUET)`,
    );

    console.log("Exporting ballots_long to Arrow format...");
    mkdirSync(dirname(paths.ingest.ballotsLong), { recursive: true });
    await conn.run(
      `COPY ballots_long TO '${paths.ingest.ballotsLong}' (FORMAT PARQUET)`,
    );

    // Step 7: Get statistics
    console.log("Computing statistics...");
    const statsResult = await conn.run(SQL_QUERIES.getCompleteStats);
    const statsArray = await statsResult.getRowObjects();
    const rawResult = statsArray[0];

    // Parse the JSON result from DuckDB
    const resultValue = rawResult.result as unknown;
    if (resultValue == null) {
      throw new Error("getCompleteStats returned null result");
    }
    const resultObject =
      typeof resultValue === "string" ? JSON.parse(resultValue) : resultValue;
    const parsedResult = IngestCvrOutputSchema.parse(resultObject);

    await conn.run("COMMIT");

    // Validate max rank
    if (parsedResult.ballots_long.max_rank > 10) {
      console.warn(
        `Warning: Maximum rank ${parsedResult.ballots_long.max_rank} exceeds 10`,
      );
    }

    // Step 8: Update manifest.json
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

    manifest[`ingest_cvr@${CONTRACT_VERSION}`] = {
      files: [paths.ingest.candidates, paths.ingest.ballotsLong],
      hashes: {}, // TODO: Implement file hashing if needed
      rows: parsedResult.ballots_long.rows,
      min_rank: parsedResult.ballots_long.min_rank,
      max_rank: parsedResult.ballots_long.max_rank,
      duplicate_ballots: parsedResult.ballots_long.duplicate_ballots,
      datasetVersion: CONTRACT_VERSION,
    };

    writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));

    // Return validated output - this should now match the Zod schema exactly
    return IngestCvrOutputSchema.parse(parsedResult);
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
