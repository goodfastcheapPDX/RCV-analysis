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
  type Data,
  Output,
  type RankDistributionByCandidateOutput,
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
  return `data/${env}/${electionId}/${contestId}/rank_distribution`;
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

export async function computeRankDistributionByCandidate(
  params: ComputeParams,
): Promise<RankDistributionByCandidateOutput> {
  const { electionId, contestId, env = "dev" } = params;

  console.log(
    `Processing rank distribution by candidate for ${electionId}/${contestId}`,
  );

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

  // Export rank distribution data to temp table
  console.log("Computing rank distribution by candidate...");
  await conn.run(SQL_QUERIES.exportRankDistribution);

  // Add identity columns
  console.log("Adding identity columns...");
  await conn.run(`
      CREATE OR REPLACE TABLE rank_distribution_with_identity AS
      SELECT
        '${electionId}' AS election_id,
        '${contestId}' AS contest_id,
        '${districtId}' AS district_id,
        ${seatCount} AS seat_count,
        candidate_id,
        rank_position,
        count,
        pct_all_ballots,
        pct_among_rankers,
        pct_among_position_rankers
      FROM rank_distribution_tmp;
    `);

  // Enforce contract: validate table schema
  console.log("Enforcing contract: validating table schema...");
  await assertTableColumns(conn, "rank_distribution_with_identity", Output);

  // Enforce contract: validate all rows
  console.log("Enforcing contract: validating all rows...");
  const parsedRows = await parseAllRows(
    conn,
    "rank_distribution_with_identity",
    Output,
  );

  // Calculate stats from validated rows (not separate SQL)
  const stats = deriveStatsFromRows(parsedRows);
  const data: Data = { rows: parsedRows.length };

  // Export to parquet
  const parquetPath = join(outputPath, "rank_distribution.parquet");
  console.log(`Exporting to ${parquetPath}...`);
  await conn.run(SQL_QUERIES.copyToParquet(outputPath));

  // Calculate deterministic hash
  const fileHash = sha256(parquetPath);
  console.log(`Rank distribution by candidate completed:`);
  console.log(`- Max rank: ${stats.max_rank}`);
  console.log(`- Total ballots: ${stats.total_ballots}`);
  console.log(`- Candidates: ${stats.candidate_count}`);
  console.log(`- Zero-rank candidates: ${stats.zero_rank_candidates}`);
  console.log(`- Output rows: ${data.rows}`);
  console.log(`- File hash: ${fileHash.substring(0, 16)}...`);

  // Update manifest - follow same pattern as first_choice
  console.log("Updating manifest...");
  const manifestData2 = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifest = Manifest.parse(manifestData2);
  const existingContest = findContest(manifest, electionId, contestId);
  if (!existingContest) {
    throw new Error(
      `Contest ${electionId}/${contestId} disappeared from manifest`,
    );
  }

  // Update contest with rank distribution artifact
  existingContest.rank_distribution = {
    uri: parquetPath,
    sha256: fileHash,
    rows: parsedRows.length,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("Build completed successfully!");

  return { stats, data };
}

function deriveStatsFromRows(rows: Output[]): Stats {
  if (rows.length === 0) {
    return {
      max_rank: 0,
      total_ballots: 0,
      candidate_count: 0,
      zero_rank_candidates: 0,
    };
  }

  const maxRank = Math.max(...rows.map((row) => row.rank_position));
  const candidateIds = new Set(rows.map((row) => row.candidate_id));
  const candidateCount = candidateIds.size;

  // Find total ballots from the first row (should be consistent across all rows)
  // Since pct_all_ballots = count / total_ballots, we can derive total_ballots
  const firstNonZeroRow = rows.find(
    (row) => row.count > 0 && row.pct_all_ballots > 0,
  );
  const totalBallots = firstNonZeroRow
    ? Math.round(firstNonZeroRow.count / firstNonZeroRow.pct_all_ballots)
    : 0;

  // Count candidates that never ranked (all their rank positions have count=0)
  const zeroRankCandidates = Array.from(candidateIds).filter((candidateId) => {
    const candidateRows = rows.filter(
      (row) => row.candidate_id === candidateId,
    );
    return candidateRows.every((row) => row.count === 0);
  }).length;

  return {
    max_rank: maxRank,
    total_ballots: totalBallots,
    candidate_count: candidateCount,
    zero_rank_candidates: zeroRankCandidates,
  };
}

// CLI interface for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [electionId, contestId, env] = process.argv.slice(2);

  if (!electionId || !contestId) {
    console.error("Usage: npx tsx compute.ts <electionId> <contestId> [env]");
    process.exit(1);
  }

  computeRankDistributionByCandidate({ electionId, contestId, env })
    .then((result) => {
      console.log("Success:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
