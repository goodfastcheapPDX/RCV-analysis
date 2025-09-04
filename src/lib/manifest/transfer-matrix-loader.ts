import { Output as TransferMatrixOutput } from "@/contracts/slices/transfer_matrix/index.contract";
import { parseAllRowsFromParquet } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolver,
} from "./contest-resolver";

/**
 * Load transfer matrix data for a specific contest
 * Uses existing contract validation from transfer_matrix slice
 */
export async function loadTransferMatrixForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const relativeUri = contestResolver.getTransferMatrixUri(
    electionId,
    contestId,
  );
  if (!relativeUri) {
    throw new Error(
      `Transfer matrix data not available for contest ${electionId}/${contestId}`,
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
  const data = await parseAllRowsFromParquet(uri, TransferMatrixOutput);

  const contest = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest,
    election,
  };
}
