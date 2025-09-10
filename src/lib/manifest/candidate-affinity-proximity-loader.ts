import { Output as CandidateAffinityProximityOutput } from "@/contracts/slices/candidate_affinity_proximity/index.contract";
import { parseAllRowsFromParquet } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolver,
} from "./contest-resolver";

/**
 * Load candidate affinity proximity data for a specific contest
 * Uses contract validation from candidate_affinity_proximity slice
 */
export async function loadCandidateAffinityProximityForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const relativeUri = contestResolver.getCandidateAffinityProximityUri(
    electionId,
    contestId,
  );
  if (!relativeUri) {
    throw new Error(
      `Candidate affinity proximity data not available for contest ${electionId}/${contestId}`,
    );
  }

  // Convert relative URI to full HTTP URL using the same pattern as other loaders
  const mockArtifact = {
    uri: relativeUri.startsWith("/") ? relativeUri.slice(1) : relativeUri,
    sha256: "",
    rows: 0,
  };
  const uri = contestResolver.resolveArtifactUrl(mockArtifact);

  // Use hyparquet to read parquet file directly with contract validation
  const data = await parseAllRowsFromParquet(
    uri,
    CandidateAffinityProximityOutput,
  );

  const contest = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest,
    election,
  };
}
