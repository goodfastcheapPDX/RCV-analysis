import { z } from "zod";
import { Output as RankDistributionOutput } from "@/contracts/slices/rank_distribution_by_candidate/index.contract";
import { parseAllRowsFromParquet } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolver,
} from "@/lib/manifest/contest-resolver";

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
  const contestResolver = resolver || (await createContestResolver(env));

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

    // Resolve artifact URI for hyparquet
    const uri = contestResolver.resolveArtifactUrl(contest.rank_distribution);

    // Use hyparquet to read parquet file directly with contract validation
    const data = await parseAllRowsFromParquet(uri, RankDistributionOutput);

    return {
      success: true,
      data,
    };
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
