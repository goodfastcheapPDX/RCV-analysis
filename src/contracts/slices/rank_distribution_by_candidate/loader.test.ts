import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { createManifestWithRankDistributionFixture } from "@/contracts/manifest";
import { ContestResolver } from "@/lib/manifest/contest-resolver";
import { loadRankDistribution } from "./loader";

// Mock the dependencies
vi.mock("@/lib/contract-enforcer", () => ({
  parseAllRowsFromParquet: vi.fn(),
}));

describe("loadRankDistribution", () => {
  it("should return error when rank distribution data not available", async () => {
    const manifest = createManifestWithRankDistributionFixture(false);
    const resolver = new ContestResolver(manifest);

    const result = await loadRankDistribution(
      "portland-20241105-gen",
      "d2-3seat",
      "test",
      resolver,
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "MISSING_ARTIFACT",
        message:
          "Rank distribution artifact not available for contest portland-20241105-gen/d2-3seat",
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
      },
    });
  });

  it("should load data when rank distribution data is available", async () => {
    const { parseAllRowsFromParquet } = await import("@/lib/contract-enforcer");

    const manifest = createManifestWithRankDistributionFixture(true);
    const resolver = new ContestResolver(manifest);
    const mockData = [{ candidate_id: 1, rank_position: 1, count: 10 }];

    vi.mocked(parseAllRowsFromParquet).mockResolvedValue(mockData);

    const result = await loadRankDistribution(
      "portland-20241105-gen",
      "d2-3seat",
      "test",
      resolver,
    );

    expect(result).toEqual({
      success: true,
      data: mockData,
    });
  });

  it("should handle validation errors", async () => {
    const { parseAllRowsFromParquet } = await import("@/lib/contract-enforcer");

    const manifest = createManifestWithRankDistributionFixture(true);
    const resolver = new ContestResolver(manifest);
    const zodError = new ZodError([]);

    vi.mocked(parseAllRowsFromParquet).mockRejectedValue(zodError);

    const result = await loadRankDistribution(
      "portland-20241105-gen",
      "d2-3seat",
      "test",
      resolver,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DATA");
    }
  });

  it("should handle unknown errors", async () => {
    const { parseAllRowsFromParquet } = await import("@/lib/contract-enforcer");

    const manifest = createManifestWithRankDistributionFixture(true);
    const resolver = new ContestResolver(manifest);

    vi.mocked(parseAllRowsFromParquet).mockRejectedValue(
      new Error("Test error"),
    );

    const result = await loadRankDistribution(
      "portland-20241105-gen",
      "d2-3seat",
      "test",
      resolver,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DATABASE_ERROR");
      expect(result.error.message).toBe("Test error");
    }
  });
});
