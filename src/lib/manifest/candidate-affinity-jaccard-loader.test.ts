import { describe, expect, it, vi } from "vitest";
import { createManifestWithCandidateAffinityJaccardFixture } from "@/contracts/manifest";
import { loadCandidateAffinityJaccardForContest } from "./candidate-affinity-jaccard-loader";
import { ContestResolver } from "./contest-resolver";

// Mock the dependencies
vi.mock("@/lib/contract-enforcer", () => ({
  parseAllRowsFromParquet: vi.fn(),
}));

describe("loadCandidateAffinityJaccardForContest", () => {
  it("should throw error when jaccard data not available", async () => {
    const manifest = createManifestWithCandidateAffinityJaccardFixture(false);
    const resolver = new ContestResolver(manifest);

    await expect(
      loadCandidateAffinityJaccardForContest(
        "portland-20241105-gen",
        "d2-3seat",
        "test",
        resolver,
      ),
    ).rejects.toThrow(
      "Candidate affinity jaccard data not available for contest portland-20241105-gen/d2-3seat",
    );
  });

  it("should load data when jaccard data is available", async () => {
    const { parseAllRowsFromParquet } = await import("@/lib/contract-enforcer");

    const manifest = createManifestWithCandidateAffinityJaccardFixture(true);
    const resolver = new ContestResolver(manifest);
    const mockData = [{ candidate_a: 1, candidate_b: 2, jaccard_index: 0.5 }];

    vi.mocked(parseAllRowsFromParquet).mockResolvedValue(mockData);

    const result = await loadCandidateAffinityJaccardForContest(
      "portland-20241105-gen",
      "d2-3seat",
      "test",
      resolver,
    );

    expect(result).toEqual({
      data: mockData,
      contest: resolver.getContest("portland-20241105-gen", "d2-3seat"),
      election: resolver.getElection("portland-20241105-gen"),
    });
  });
});
