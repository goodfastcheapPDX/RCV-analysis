import { describe, expect, it, vi } from "vitest";
import { getArtifactPaths } from "./artifact-paths.js";

describe("getArtifactPaths", () => {
  it("returns dev paths when not in test environment", () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("VITEST", "");

    const paths = getArtifactPaths();

    expect(paths.ingest.candidates).toBe("data/dev/ingest/candidates.parquet");
    expect(paths.ingest.ballotsLong).toBe(
      "data/dev/ingest/ballots_long.parquet",
    );
    expect(paths.summary.firstChoice).toBe(
      "data/dev/summary/first_choice.parquet",
    );
    expect(paths.manifest).toBe("manifest.dev.json");

    vi.unstubAllEnvs();
  });

  it("returns test paths when NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VITEST", "");

    const paths = getArtifactPaths();

    expect(paths.ingest.candidates).toBe("data/test/ingest/candidates.parquet");
    expect(paths.ingest.ballotsLong).toBe(
      "data/test/ingest/ballots_long.parquet",
    );
    expect(paths.summary.firstChoice).toBe(
      "data/test/summary/first_choice.parquet",
    );
    expect(paths.manifest).toBe("manifest.test.json");

    vi.unstubAllEnvs();
  });

  it("returns test paths when VITEST=true", () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("VITEST", "true");

    const paths = getArtifactPaths();

    expect(paths.ingest.candidates).toBe("data/test/ingest/candidates.parquet");
    expect(paths.ingest.ballotsLong).toBe(
      "data/test/ingest/ballots_long.parquet",
    );
    expect(paths.summary.firstChoice).toBe(
      "data/test/summary/first_choice.parquet",
    );
    expect(paths.manifest).toBe("manifest.test.json");

    vi.unstubAllEnvs();
  });
});
