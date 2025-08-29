import { type DataEnv, getArtifactRoot } from "@/lib/env";

const CANON_ELECTION = "portland-20241105-gen";
const CANON_CONTEST = "d2-3seat";

export type ArtifactPaths = {
  firstChoiceParquet?: string;
  stvTabulationParquet: string;
  stvMetaParquet: string;
};

export function getArtifacts(
  electionId: string,
  contestId: string,
  env: DataEnv,
): ArtifactPaths {
  if (electionId !== CANON_ELECTION || contestId !== CANON_CONTEST) {
    throw new Error(
      `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=${env}).`,
    );
  }
  const root = getArtifactRoot(env);
  return {
    firstChoiceParquet: `${root}/${electionId}/${contestId}/first_choice/first_choice.parquet`,
    stvTabulationParquet: `${root}/${electionId}/${contestId}/stv/rounds.parquet`,
    stvMetaParquet: `${root}/${electionId}/${contestId}/stv/meta.parquet`,
  };
}
