import { Output as CandidateAffinityJaccardOutput } from "@/contracts/slices/candidate_affinity_jaccard/index.contract";
import { parseAllRowsFromParquet } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolver,
} from "./contest-resolver";

/**
 * Load candidate affinity jaccard data for a specific contest
 * Uses contract validation from candidate_affinity_jaccard slice
 */
export async function loadCandidateAffinityJaccardForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const relativeUri = contestResolver.getCandidateAffinityJaccardUri(
    electionId,
    contestId,
  );
  if (!relativeUri) {
    throw new Error(
      `Candidate affinity jaccard data not available for contest ${electionId}/${contestId}`,
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
    CandidateAffinityJaccardOutput,
  );

  const contest = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest,
    election,
  };
}
