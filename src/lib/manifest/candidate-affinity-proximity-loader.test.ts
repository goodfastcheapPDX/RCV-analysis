import { describe, expect, it, vi } from "vitest";
import { createManifestWithCandidateAffinityProximityFixture } from "@/contracts/manifest";
import { loadCandidateAffinityProximityForContest } from "./candidate-affinity-proximity-loader";
import { ContestResolver } from "./contest-resolver";

// Mock the dependencies
vi.mock("@/lib/contract-enforcer", () => ({
  parseAllRowsFromParquet: vi.fn(),
}));

describe("loadCandidateAffinityProximityForContest", () => {
  it("should throw error when proximity data not available", async () => {
    const manifest = createManifestWithCandidateAffinityProximityFixture(false);
    const resolver = new ContestResolver(manifest);

    await expect(
      loadCandidateAffinityProximityForContest(
        "portland-20241105-gen",
        "d2-3seat",
        "test",
        resolver,
      ),
    ).rejects.toThrow(
      "Candidate affinity proximity data not available for contest portland-20241105-gen/d2-3seat",
    );
  });

  it("should load data when proximity data is available", async () => {
    const { parseAllRowsFromParquet } = await import("@/lib/contract-enforcer");

    const manifest = createManifestWithCandidateAffinityProximityFixture(true);
    const resolver = new ContestResolver(manifest);
    const mockData = [{ candidate_a: 1, candidate_b: 2, weight_sum: 10 }];

    vi.mocked(parseAllRowsFromParquet).mockResolvedValue(mockData);

    const result = await loadCandidateAffinityProximityForContest(
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
