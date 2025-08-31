import { loadFirstChoiceForContest } from "@/lib/manifest/loaders";

export interface FirstChoiceDataParams {
  electionId?: string;
  contestId?: string;
}

export async function handleFirstChoiceDataRequest(
  params: FirstChoiceDataParams = {},
) {
  try {
    // Get election and contest from params, with defaults
    const electionId = params.electionId || "portland-20241105-gen";
    const contestId = params.contestId || "d2-3seat";

    // Load contest data using new loader
    const result = await loadFirstChoiceForContest(electionId, contestId);

    return {
      success: true,
      data: {
        electionId,
        contestId,
        data: result.data,
        metadata: {
          contest: result.contest,
          artifactUri: result.contest.first_choice?.uri || null,
        },
      },
    };
  } catch (error) {
    console.error("Error in first choice data handler:", error);
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
