import { loadStvForContest } from "@/lib/manifest/loaders";

export interface StvDataParams {
  electionId?: string;
  contestId?: string;
}

export async function handleStvDataRequest(params: StvDataParams = {}) {
  try {
    // Get election and contest from params, with defaults
    const electionId = params.electionId || "portland-20241105-gen";
    const contestId = params.contestId || "d2-3seat";

    // Use DATA_ENV from environment variables
    const env = process.env.DATA_ENV;

    // Load contest data using new loader
    const result = await loadStvForContest(electionId, contestId, env);

    return {
      success: true,
      data: {
        electionId,
        contestId,
        roundsData: result.roundsData,
        metaData: result.metaData,
        stats: result.stats,
        metadata: {
          contest: result.contest,
          roundsUri: result.contest.stv.rounds?.uri || null,
          metaUri: result.contest.stv.meta?.uri || null,
        },
      },
    };
  } catch (error) {
    console.error("Error in STV data handler:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      status:
        error instanceof Error && error.message.includes("not found")
          ? 404
          : 500,
    };
  }
}
