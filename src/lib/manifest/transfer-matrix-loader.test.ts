import { describe, expect, it, vi } from "vitest";
import { createManifestWithTransferMatrixFixture } from "@/contracts/manifest";
import { ContestResolver } from "./contest-resolver";
import { loadTransferMatrixForContest } from "./transfer-matrix-loader";

// Mock the dependencies
vi.mock("@/lib/contract-enforcer", () => ({
  parseAllRowsFromParquet: vi.fn(),
}));

describe("loadTransferMatrixForContest", () => {
  it("should throw error when transfer matrix data not available", async () => {
    const manifest = createManifestWithTransferMatrixFixture(false);
    const resolver = new ContestResolver(manifest);

    await expect(
      loadTransferMatrixForContest(
        "portland-20241105-gen",
        "d2-3seat",
        "test",
        resolver,
      ),
    ).rejects.toThrow(
      "Transfer matrix data not available for contest portland-20241105-gen/d2-3seat",
    );
  });

  it("should load data when transfer matrix data is available", async () => {
    const { parseAllRowsFromParquet } = await import("@/lib/contract-enforcer");

    const manifest = createManifestWithTransferMatrixFixture(true);
    const resolver = new ContestResolver(manifest);
    const mockData = [{ from_candidate: 1, to_candidate: 2, count: 10 }];

    vi.mocked(parseAllRowsFromParquet).mockResolvedValue(mockData);

    const result = await loadTransferMatrixForContest(
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
