import { z } from "zod";
import {
  type ContestResolver,
  createContestResolverSync,
} from "@/lib/manifest/contest-resolver";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import { Output as RankDistributionOutput } from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";

// Error types for better error handling
export const RankDistributionError = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("MISSING_ARTIFACT"),
    message: z.string(),
    electionId: z.string(),
    contestId: z.string(),
  }),
  z.object({
    code: z.literal("INVALID_DATA"),
    message: z.string(),
    cause: z.unknown(),
  }),
  z.object({
    code: z.literal("DATABASE_ERROR"),
    message: z.string(),
    cause: z.unknown(),
  }),
]);

export type RankDistributionError = z.infer<typeof RankDistributionError>;

// Result type for the loader function
export type RankDistributionResult =
  | { success: true; data: RankDistributionOutput[] }
  | { success: false; error: RankDistributionError };

// Selected candidate data type
export type CandidateRankDistribution = {
  rank: number;
  count: number;
  pct_all_ballots: number;
  pct_among_rankers: number;
};

/**
 * Load rank distribution data for a specific contest
 * Returns all candidates' rank distribution data from the precomputed artifact
 */
export async function loadRankDistribution(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
): Promise<RankDistributionResult> {
  const contestResolver = resolver || createContestResolverSync(env);

  try {
    // Get contest with rank distribution data
    const contest = contestResolver.getContest(electionId, contestId);

    if (!contest.rank_distribution?.uri) {
      return {
        success: false,
        error: {
          code: "MISSING_ARTIFACT",
          message: `Rank distribution artifact not available for contest ${electionId}/${contestId}`,
          electionId,
          contestId,
        },
      };
    }

    // Dynamically import DuckDB to avoid SSG issues
    const duck = await import("@duckdb/node-api");
    const instance = await duck.DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      // Create view directly from parquet file
      await conn.run(
        `CREATE VIEW rank_distribution_data AS SELECT * FROM '${contest.rank_distribution.uri}'`,
      );

      // Use contract enforcer to get validated data
      const data = await parseAllRows(
        conn,
        "rank_distribution_data",
        RankDistributionOutput,
      );

      return {
        success: true,
        data,
      };
    } finally {
      await conn.closeSync();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: "INVALID_DATA",
          message: `Data validation failed: ${error.message}`,
          cause: error,
        },
      };
    }

    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message:
          error instanceof Error ? error.message : "Unknown database error",
        cause: error,
      },
    };
  }
}

/**
 * Filter rank distribution data for a specific candidate
 * Fills in missing ranks with zero values and sorts by rank position
 */
export function selectCandidateRankDistribution(
  rows: RankDistributionOutput[],
  candidateId: number,
): CandidateRankDistribution[] {
  // Filter rows for this candidate
  const candidateRows = rows.filter((row) => row.candidate_id === candidateId);

  if (candidateRows.length === 0) {
    return [];
  }

  // Find the maximum rank position in the data to ensure we fill gaps
  const maxRank = Math.max(...rows.map((row) => row.rank_position));

  // Create a complete sequence from 1 to maxRank
  const result: CandidateRankDistribution[] = [];

  for (let rank = 1; rank <= maxRank; rank++) {
    const existing = candidateRows.find((row) => row.rank_position === rank);

    if (existing) {
      result.push({
        rank: existing.rank_position,
        count: existing.count,
        pct_all_ballots: existing.pct_all_ballots,
        pct_among_rankers: existing.pct_among_rankers,
      });
    } else {
      // Fill in missing rank with zeros
      result.push({
        rank,
        count: 0,
        pct_all_ballots: 0,
        pct_among_rankers: 0,
      });
    }
  }

  return result.sort((a, b) => a.rank - b.rank);
}

/**
 * Check if a candidate has any ranking data (not zero-rank)
 */
export function candidateHasRankers(
  distribution: CandidateRankDistribution[],
): boolean {
  return distribution.some((row) => row.count > 0);
}

/**
 * Get the maximum rank position in the distribution data
 */
export function getMaxRank(rows: RankDistributionOutput[]): number {
  return Math.max(...rows.map((row) => row.rank_position), 0);
}
