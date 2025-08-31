import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import { Output as FirstChoiceOutput } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";
import {
  StvMetaOutput,
  StvRoundsOutput,
  type StvRoundsStats,
} from "@/packages/contracts/slices/stv_rounds/index.contract";
import {
  type ContestResolver,
  createContestResolverSync,
} from "./contest-resolver";

/**
 * Load first-choice data for a specific contest
 * Uses existing contract validation from first_choice slice
 */
export async function loadFirstChoiceForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || createContestResolverSync(env);

  const uri = contestResolver.getFirstChoiceUri(electionId, contestId);
  if (!uri) {
    throw new Error(
      `First-choice data not available for contest ${electionId}/${contestId}`,
    );
  }

  // Dynamically import DuckDB to avoid SSG issues
  const duck = await import("@duckdb/node-api");
  const instance = await duck.DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create view directly from parquet file
    await conn.run(`CREATE VIEW first_choice_data AS SELECT * FROM '${uri}'`);

    // Use contract enforcer to get validated data
    const data = await parseAllRows(
      conn,
      "first_choice_data",
      FirstChoiceOutput,
    );

    const contest = contestResolver.getContest(electionId, contestId);
    const election = contestResolver.getElection(electionId);

    return {
      data,
      contest,
      election,
    };
  } finally {
    await conn.closeSync();
  }
}

/**
 * Load STV rounds data for a specific contest
 * Uses existing contract validation from stv_rounds slice
 */
export async function loadStvForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || createContestResolverSync(env);

  const roundsUri = contestResolver.getStvRoundsUri(electionId, contestId);
  const metaUri = contestResolver.getStvMetaUri(electionId, contestId);

  if (!roundsUri) {
    throw new Error(
      `STV data not available for contest ${electionId}/${contestId}`,
    );
  }

  const contest = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  // Dynamically import DuckDB to avoid SSG issues
  const duck = await import("@duckdb/node-api");
  const instance = await duck.DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create views directly from parquet files
    await conn.run(`CREATE VIEW stv_rounds AS SELECT * FROM '${roundsUri}'`);
    if (metaUri) {
      await conn.run(`CREATE VIEW stv_meta AS SELECT * FROM '${metaUri}'`);
    }

    // Use contract enforcer to get validated data
    const roundsData = await parseAllRows(conn, "stv_rounds", StvRoundsOutput);
    const metaData = metaUri
      ? await parseAllRows(conn, "stv_meta", StvMetaOutput)
      : [];

    // Calculate basic stats from rounds data
    const stats: StvRoundsStats = {
      number_of_rounds: Math.max(...roundsData.map((r) => r.round)),
      winners: [
        ...new Set(
          roundsData
            .filter((r) => r.status === "elected")
            .map((r) => r.candidate_name),
        ),
      ],
      seats: contest.seat_count,
      first_round_quota: metaData.find((m) => m.round === 1)?.quota || 0,
      precision: 0.000001,
    };

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
