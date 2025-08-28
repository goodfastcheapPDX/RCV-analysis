import { type DataEnv, getArtifactRoot } from "@/lib/env";

const CANON_ELECTION = "portland-2024-general";
const CANON_CONTEST = "council-district-2";

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
    firstChoiceParquet: `${root}/summary/first_choice.parquet`,
    stvTabulationParquet: `${root}/stv/stv_rounds.parquet`,
    stvMetaParquet: `${root}/stv/stv_meta.parquet`,
  };
}
