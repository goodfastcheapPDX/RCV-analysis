import { existsSync } from "node:fs";
import {
  type Contest,
  type Election,
  findContest,
  findElection,
  type Manifest,
} from "@/contracts/manifest";
import { getContestArtifacts, loadManifestSync } from "@/lib/manifest";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import { Output as FirstChoiceOutput } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";
import {
  StvMetaOutput,
  StvRoundsOutput,
  type StvRoundsStats,
} from "@/packages/contracts/slices/stv_rounds/index.contract";

/**
 * Load election data with all contests using validated manifest data
 */
export function loadElectionWithContests(electionId: string): {
  election: Election;
  manifest: Manifest;
} {
  const manifest = loadManifestSync();
  const election = findElection(manifest, electionId);

  if (!election) {
    throw new Error(`Election '${electionId}' not found in manifest`);
  }

  return { election, manifest };
}

/**
 * Load contest data with validation
 */
export function loadContestData(
  electionId: string,
  contestId: string,
): {
  contest: Contest;
  election: Election;
  artifacts: ReturnType<typeof getContestArtifacts>;
} {
  const manifest = loadManifestSync();
  const election = findElection(manifest, electionId);

  if (!election) {
    throw new Error(`Election '${electionId}' not found in manifest`);
  }

  const contest = findContest(manifest, electionId, contestId);
  if (!contest) {
    throw new Error(
      `Contest '${contestId}' not found in election '${electionId}'`,
    );
  }

  const artifacts = getContestArtifacts(manifest, electionId, contestId);

  return { contest, election, artifacts };
}

/**
 * Load STV rounds data for a specific contest with contract validation
 */
export async function loadStvForContest(
  electionId: string,
  contestId: string,
): Promise<{
  roundsData: StvRoundsOutput[];
  metaData: StvMetaOutput[];
  stats: StvRoundsStats | null;
  contest: Contest;
  election: Election;
}> {
  const { contest, election, artifacts } = loadContestData(
    electionId,
    contestId,
  );

  // Verify both STV rounds and meta parquet files exist
  if (!artifacts.stvRounds || !existsSync(artifacts.stvRounds)) {
    throw new Error(
      `STV rounds data not found for ${electionId}/${contestId}. Expected: ${
        artifacts.stvRounds || "not generated"
      }. Run STV rounds computation first.`,
    );
  }

  if (!artifacts.stvMeta || !existsSync(artifacts.stvMeta)) {
    throw new Error(
      `STV meta data not found for ${electionId}/${contestId}. Expected: ${
        artifacts.stvMeta || "not generated"
      }. Run STV rounds computation first.`,
    );
  }

  // Dynamically import DuckDB to avoid SSG issues
  const duck = await import("@duckdb/node-api");

  const instance = await duck.DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create views from both parquet files
    await conn.run(
      `CREATE VIEW stv_rounds_data AS SELECT * FROM '${artifacts.stvRounds}'`,
    );

    await conn.run(
      `CREATE VIEW stv_meta_data AS SELECT * FROM '${artifacts.stvMeta}'`,
    );

    // Get rounds data with contract validation
    const roundsData = await parseAllRows(
      conn,
      "stv_rounds_data",
      StvRoundsOutput,
    );

    // Get meta data with contract validation
    const metaData = await parseAllRows(conn, "stv_meta_data", StvMetaOutput);

    // Get stats from manifest
    const stats = contest.stv.stats || null;

    return {
      roundsData,
      metaData,
      stats,
      contest,
      election,
    };
  } finally {
    await conn.closeSync();
  }
}

/**
 * Load first choice breakdown data for a specific contest with contract validation
 */
export async function loadFirstChoiceForContest(
  electionId: string,
  contestId: string,
): Promise<{
  data: FirstChoiceOutput[];
  contest: Contest;
  election: Election;
}> {
  const { contest, election, artifacts } = loadContestData(
    electionId,
    contestId,
  );

  // Verify the first choice parquet file exists
  if (!artifacts.firstChoice || !existsSync(artifacts.firstChoice)) {
    throw new Error(
      `First choice data not found for ${electionId}/${contestId}. Expected: ${
        artifacts.firstChoice || "not generated"
      }. Run first choice breakdown computation first.`,
    );
  }

  // Dynamically import DuckDB to avoid SSG issues
  const duck = await import("@duckdb/node-api");

  const instance = await duck.DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create view directly from parquet file
    await conn.run(
      `CREATE VIEW first_choice_data AS SELECT * FROM '${artifacts.firstChoice}'`,
    );

    // Use contract enforcer to get validated Output[] data
    const validatedRows = await parseAllRows(
      conn,
      "first_choice_data",
      FirstChoiceOutput,
    );

    return {
      data: validatedRows,
      contest,
      election,
    };
  } finally {
    await conn.closeSync();
  }
}
