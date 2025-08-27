/**
 * Environment-based artifact path resolution for dev/test isolation.
 *
 * This utility provides separate artifact paths for development and testing:
 * - Development: data/dev/ (persistent, real election data)
 * - Testing: data/test/ (ephemeral, golden micro data)
 */

export interface ArtifactPaths {
  ingest: {
    candidates: string;
    ballotsLong: string;
  };
  stv: {
    meta: string;
    rounds: string;
  };
  summary: {
    firstChoice: string;
  };
  manifest: string;
}

/**
 * Get artifact paths based on current environment.
 * Tests use data/test/, development uses data/dev/
 */
export function getArtifactPaths(): ArtifactPaths {
  const isTest =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const base = isTest ? "data/test" : "data/dev";

  return {
    ingest: {
      candidates: `${base}/ingest/candidates.parquet`,
      ballotsLong: `${base}/ingest/ballots_long.parquet`,
    },
    stv: {
      meta: `${base}/stv/stv_meta.parquet`,
      rounds: `${base}/stv/stv_rounds.parquet`,
    },
    summary: {
      firstChoice: `${base}/summary/first_choice.parquet`,
    },
    manifest: isTest ? "manifest.test.json" : "manifest.dev.json",
  };
}
