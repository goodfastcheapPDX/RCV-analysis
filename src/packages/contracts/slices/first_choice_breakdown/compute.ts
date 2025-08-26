import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname } from "path";
import { mkdirSync } from "fs";
import { createHash } from "crypto";
import {
  FirstChoiceBreakdownOutput,
  FirstChoiceBreakdownOutputSchema,
  CONTRACT_VERSION,
  SQL_QUERIES,
} from "./index.contract.js";

interface ManifestEntry {
  files: string[];
  hashes: Record<string, string>;
  stats: {
    total_valid_ballots: number;
    candidate_count: number;
    sum_first_choice: number;
  };
  data: {
    rows: number;
  };
  datasetVersion: string;
}

function calculateFileHash(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  const hashSum = createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
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

    // Step 3: Export first choice breakdown to parquet
    console.log("Computing and exporting first choice breakdown...");
    await conn.run(SQL_QUERIES.exportFirstChoice);
    await conn.run(SQL_QUERIES.copyToParquet);

    // Step 4: Get statistics
    console.log("Computing statistics...");
    const statsResult = await conn.run(SQL_QUERIES.getFirstChoiceStats);
    const statsArray = await statsResult.getRowObjects();
    const rawResult = statsArray[0];

    // Parse the JSON result from DuckDB
    const resultValue = rawResult.result as unknown;
    if (resultValue == null) {
      throw new Error("getFirstChoiceStats returned null result");
    }
    const resultObject =
      typeof resultValue === "string" ? JSON.parse(resultValue) : resultValue;
    const parsedResult = FirstChoiceBreakdownOutputSchema.parse(resultObject);

    await conn.run("COMMIT");

    // Step 5: Calculate file hash
    const outputPath = "data/summary/first_choice.parquet";
    const fileHash = calculateFileHash(outputPath);

    // Step 6: Update manifest.json
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

    manifest[`first_choice_breakdown@${CONTRACT_VERSION}`] = {
      files: ["data/summary/first_choice.parquet"],
      hashes: {
        "data/summary/first_choice.parquet": fileHash,
      },
      stats: parsedResult.stats,
      data: parsedResult.data,
      datasetVersion: CONTRACT_VERSION,
    };

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

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
