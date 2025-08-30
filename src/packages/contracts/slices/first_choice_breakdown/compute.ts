import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  type ContestId,
  createIdentity,
  type DistrictId,
  type ElectionId,
} from "@/contracts/ids";
import {
  findContest,
  getArtifactUri,
  type Manifest,
} from "@/contracts/manifest";
import { getDataEnv } from "@/lib/env";
import {
  assertManifestSection,
  assertTableColumns,
  parseAllRows,
  sha256,
} from "@/packages/contracts/lib/contract-enforcer";
import {
  Data,
  type FirstChoiceBreakdownOutput,
  Output,
  SQL_QUERIES,
  Stats,
  version,
} from "./index.contract";

interface FirstChoiceBreakdownOptions {
  electionId: ElectionId;
  contestId: ContestId;
  districtId: DistrictId;
  seatCount: number;
}

function getOutputPath(
  env: string,
  electionId: ElectionId,
  contestId: ContestId,
): string {
  return `data/${env}/${electionId}/${contestId}/first_choice`;
}

function getManifestPath(env: string): string {
  return `data/${env}/manifest.json`;
}

export async function computeFirstChoiceBreakdown(
  options?: FirstChoiceBreakdownOptions,
): Promise<FirstChoiceBreakdownOutput> {
  // Support both new parameterized call and legacy environment-based call
  const electionId =
    options?.electionId || ("portland-20241105-gen" as ElectionId);
  const contestId = options?.contestId || ("d2-3seat" as ContestId);
  const districtId = options?.districtId || ("d2" as DistrictId);
  const seatCount = options?.seatCount || 3;

  const env = getDataEnv();
  const outputPath = getOutputPath(env, electionId, contestId);
  const manifestPath = getManifestPath(env);

  // Create identity for this contest
  const identity = createIdentity(electionId, contestId, districtId, seatCount);

  console.log(
    `Processing first choice breakdown for ${electionId}/${contestId}`,
  );
  console.log(`Output path: ${outputPath}`);

  // Load manifest to find input files
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Manifest not found: ${manifestPath}. Run ingest_cvr first.`,
    );
  }

  let manifestData: Manifest;
  try {
    manifestData = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  } catch (error) {
    throw new Error(
      `Failed to parse manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}. Run ingest_cvr first.`,
    );
  }
  const contest = findContest(manifestData, electionId, contestId);
  if (!contest) {
    throw new Error(
      `Contest ${electionId}/${contestId} not found in manifest. Run ingest_cvr first.`,
    );
  }

  const ballotsLongPath = getArtifactUri(contest.cvr.ballots_long);
  if (!existsSync(ballotsLongPath)) {
    throw new Error(
      `Input file not found: ${ballotsLongPath}. Run ingest_cvr first.`,
    );
  }

  // Ensure output directory exists
  mkdirSync(outputPath, { recursive: true });

  // Create database instance
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run("BEGIN TRANSACTION");

    // Step 1: Create view from existing ballots_long parquet
    console.log(`Creating ballots_long view from ${ballotsLongPath}...`);
    await conn.run(SQL_QUERIES.createFirstChoiceView(dirname(ballotsLongPath)));

    // Step 2: Create temporary table for validation
    console.log("Computing first choice breakdown...");
    await conn.run(SQL_QUERIES.exportFirstChoice);

    // Step 3: Add identity columns to output
    console.log("Adding identity columns...");
    await conn.run(`
      CREATE OR REPLACE TABLE first_choice_breakdown_with_identity AS
      SELECT
        '${identity.election_id}' AS election_id,
        '${identity.contest_id}' AS contest_id,
        '${identity.district_id}' AS district_id,
        ${identity.seat_count} AS seat_count,
        candidate_name,
        first_choice_votes,
        pct
      FROM first_choice_breakdown;
    `);

    // Step 4: ENFORCE CONTRACT - Validate schema before exporting
    console.log("Enforcing contract: validating table schema...");
    await assertTableColumns(
      conn,
      "first_choice_breakdown_with_identity",
      Output,
    );

    // Step 5: ENFORCE CONTRACT - Validate all data through Zod
    console.log("Enforcing contract: validating all rows...");
    const validatedRows = await parseAllRows(
      conn,
      "first_choice_breakdown_with_identity",
      Output,
    );

    if (validatedRows.length === 0) {
      throw new Error("No valid rows found in first_choice_breakdown table");
    }

    // Step 6: Export to Parquet files
    console.log(`Exporting to ${outputPath}/first_choice.parquet...`);
    await conn.run(SQL_QUERIES.copyToParquet(outputPath));

    await conn.run("COMMIT");

    // Step 7: Derive stats from validated data (not from separate SQL)
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

    // Step 8: Calculate file hash and update manifest
    const firstChoicePath = `${outputPath}/first_choice.parquet`;
    const fileHash = sha256(firstChoicePath);

    // Update manifest
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    const existingContest = findContest(manifest, electionId, contestId);
    if (!existingContest) {
      throw new Error(
        `Contest ${electionId}/${contestId} disappeared from manifest`,
      );
    }

    // Update contest with first choice artifact
    existingContest.first_choice = {
      uri: firstChoicePath,
      sha256: fileHash,
      rows: validatedRows.length,
    };

    // Update manifest timestamp
    manifest.generated_at = new Date().toISOString();

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const parsedResult: FirstChoiceBreakdownOutput = {
      stats: validatedStats,
      data: validatedData,
    };

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
