import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { findContest, Manifest } from "@/contracts/manifest";
import {
  assertManifestSection,
  assertTableColumns,
  parseAllRows,
  sha256,
} from "@/lib/contract-enforcer";
import {
  type CandidateAffinityMatrixOutput,
  type Data,
  Output,
  SQL_QUERIES,
  type Stats,
  version,
} from "./index.contract";

export interface ComputeParams {
  electionId: string;
  contestId: string;
  env?: string;
}

function getOutputPath(
  env: string,
  electionId: string,
  contestId: string,
): string {
  return `data/${env}/${electionId}/${contestId}/candidate_affinity_matrix`;
}

function getManifestPath(env: string): string {
  return `data/${env}/manifest.json`;
}

function getInputPath(
  env: string,
  electionId: string,
  contestId: string,
): string {
  return `data/${env}/${electionId}/${contestId}/ingest`;
}

export async function computeCandidateAffinityMatrix(
  params: ComputeParams,
): Promise<CandidateAffinityMatrixOutput> {
  const { electionId, contestId, env = "dev" } = params;

  console.log(
    `Processing candidate affinity matrix for ${electionId}/${contestId}`,
  );

  const startTime = Date.now();
  const manifestPath = getManifestPath(env);
  const inputPath = getInputPath(env, electionId, contestId);
  const outputPath = getOutputPath(env, electionId, contestId);

  console.log(`Output path: ${outputPath}`);

  // Load manifest to get contest metadata
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Manifest not found: ${manifestPath}. Run ingest_cvr first.`,
    );
  }

  const manifestData = JSON.parse(readFileSync(manifestPath, "utf8"));
  const initialManifest = Manifest.parse(manifestData);

  // Find the contest in manifest
  const election = initialManifest.elections.find(
    (e) => e.election_id === electionId,
  );
  if (!election) {
    throw new Error(`Election ${electionId} not found in manifest`);
  }

  const contest = election.contests.find((c) => c.contest_id === contestId);
  if (!contest) {
    throw new Error(`Contest ${contestId} not found in manifest`);
  }

  // Extract contest metadata from manifest instead of parsing contestId
  const districtId = contest.district_id;
  const seatCount = contest.seat_count;

  // Ensure output directory exists
  mkdirSync(outputPath, { recursive: true });

  const db = await DuckDBInstance.create();
  const conn = await db.connect();

  // Create view from input parquet
  console.log(
    `Creating ballots_long view from ${inputPath}/ballots_long.parquet...`,
  );
  await conn.run(SQL_QUERIES.createBallotsLongView(inputPath));

  // Log input data info
  console.log("Analyzing input data...");
  const inputStatsResult = await conn.run(`
    SELECT 
      COUNT(*) as total_rows,
      COUNT(DISTINCT BallotID) as unique_ballots,
      COUNT(CASE WHEN rank_position IS NOT NULL THEN 1 END) as ranked_rows
    FROM ballots_long
  `);
  const inputStatsRows = await inputStatsResult.getRowObjects();
  const inputStats = inputStatsRows[0];
  console.log(
    `Input: ${inputStats.total_rows} rows, ${inputStats.unique_ballots} ballots, ${inputStats.ranked_rows} with ranks`,
  );

  // Export affinity matrix data to temp table
  console.log("Computing candidate affinity matrix...");
  await conn.run(SQL_QUERIES.exportAffinityMatrix);

  // Log dedup and pair generation info
  const dedupStatsResult = await conn.run(`
    WITH ranked AS (
      SELECT BallotID, candidate_id
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id
    )
    SELECT 
      COUNT(*) as deduped_rows,
      COUNT(DISTINCT BallotID) as ballots_with_ranks
    FROM ranked
  `);
  const dedupStatsRows = await dedupStatsResult.getRowObjects();
  const dedupStats = dedupStatsRows[0];
  console.log(
    `After dedup: ${dedupStats.deduped_rows} rows from ${dedupStats.ballots_with_ranks} ballots`,
  );

  // Add identity columns
  console.log("Adding identity columns...");
  await conn.run(`
      CREATE OR REPLACE TABLE candidate_affinity_matrix_with_identity AS
      SELECT
        '${electionId}' AS election_id,
        '${contestId}' AS contest_id,
        '${districtId}' AS district_id,
        ${seatCount} AS seat_count,
        candidate_a,
        candidate_b,
        cooccurrence_count,
        cooccurrence_frac
      FROM candidate_affinity_matrix_tmp;
    `);

  // Enforce contract: validate table schema
  console.log("Enforcing contract: validating table schema...");
  await assertTableColumns(
    conn,
    "candidate_affinity_matrix_with_identity",
    Output,
  );

  // Enforce contract: validate all rows
  console.log("Enforcing contract: validating all rows...");
  const parsedRows = await parseAllRows(
    conn,
    "candidate_affinity_matrix_with_identity",
    Output,
  );

  // Calculate compute time
  const computeMs = Date.now() - startTime;

  // Calculate stats from validated rows
  const stats = deriveStatsFromRows(parsedRows, computeMs);
  const data: Data = { rows: parsedRows.length };

  // Export to parquet
  const parquetPath = join(outputPath, "candidate_affinity_matrix.parquet");
  console.log(`Exporting to ${parquetPath}...`);
  await conn.run(SQL_QUERIES.copyToParquet(outputPath));

  // Calculate deterministic hash
  const fileHash = sha256(parquetPath);
  console.log(`Candidate affinity matrix completed:`);
  console.log(`- Total ballots considered: ${stats.total_ballots_considered}`);
  console.log(`- Unique pairs: ${stats.unique_pairs}`);
  console.log(`- Max pair fraction: ${stats.max_pair_frac.toFixed(4)}`);
  console.log(`- Compute time: ${stats.compute_ms}ms`);
  console.log(`- Output rows: ${data.rows}`);
  console.log(`- File hash: ${fileHash.substring(0, 16)}...`);

  // Update manifest
  console.log("Updating manifest...");
  const manifestData2 = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifest = Manifest.parse(manifestData2);
  const existingContest = findContest(manifest, electionId, contestId);
  if (!existingContest) {
    throw new Error(
      `Contest ${electionId}/${contestId} disappeared from manifest`,
    );
  }

  // Update contest with candidate affinity matrix artifact
  existingContest.candidate_affinity_matrix = {
    uri: parquetPath,
    sha256: fileHash,
    rows: parsedRows.length,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("Build completed successfully!");

  await conn.closeSync();

  return { stats, data };
}

function deriveStatsFromRows(rows: Output[], computeMs: number): Stats {
  if (rows.length === 0) {
    return {
      total_ballots_considered: 0,
      unique_pairs: 0,
      max_pair_frac: 0,
      compute_ms: computeMs,
    };
  }

  const uniquePairs = rows.length;
  const maxPairFrac = Math.max(...rows.map((row) => row.cooccurrence_frac));

  // Derive total ballots from first row: cooccurrence_frac = cooccurrence_count / total_ballots
  const firstRow = rows[0];
  const totalBallots =
    firstRow.cooccurrence_frac > 0
      ? Math.round(firstRow.cooccurrence_count / firstRow.cooccurrence_frac)
      : 0;

  return {
    total_ballots_considered: totalBallots,
    unique_pairs: uniquePairs,
    max_pair_frac: maxPairFrac,
    compute_ms: computeMs,
  };
}

// CLI interface for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [electionId, contestId, env] = process.argv.slice(2);

  if (!electionId || !contestId) {
    console.error("Usage: npx tsx compute.ts <electionId> <contestId> [env]");
    process.exit(1);
  }

  computeCandidateAffinityMatrix({ electionId, contestId, env })
    .then((result) => {
      console.log("Success:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
