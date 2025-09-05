import { Output as CandidateAffinityMatrixOutput } from "@/contracts/slices/candidate_affinity_matrix/index.contract";
import { parseAllRowsFromParquet } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolver,
} from "./contest-resolver";

/**
 * Load candidate affinity matrix data for a specific contest
 * Uses existing contract validation from candidate_affinity_matrix slice
 */
export async function loadCandidateAffinityMatrixForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const relativeUri = contestResolver.getCandidateAffinityMatrixUri(
    electionId,
    contestId,
  );
  if (!relativeUri) {
    throw new Error(
      `Candidate affinity matrix data not available for contest ${electionId}/${contestId}`,
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
    CandidateAffinityMatrixOutput,
  );

  const contest = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest,
    election,
  };
}
