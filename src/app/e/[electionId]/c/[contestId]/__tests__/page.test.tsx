import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import type {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "@/contracts/slices/stv_rounds/index.contract";
import ContestPage from "../page";

// Mock the environment to use test data
vi.mock("@/lib/env", () => ({
  getDataEnv: () => "test",
}));

// Mock the StvRoundsView component to avoid complex rendering in tests
vi.mock("@/contracts/slices/stv_rounds/view", () => ({
  StvRoundsView: ({
    roundsData,
    metaData,
    stats,
  }: {
    roundsData: StvRoundsOutput[];
    metaData: StvMetaOutput[];
    stats: StvRoundsStats;
    candidates?: CandidatesOutput[];
    electionId?: string;
    contestId?: string;
  }) => (
    <div data-testid="stv-rounds-view">
      STV Rounds: {roundsData?.length || 0} rounds, Meta:{" "}
      {metaData?.length || 0} entries, Stats: {stats ? "present" : "none"}
    </div>
  ),
}));

describe("Contest Page (STV Rounds)", () => {
  it("should handle missing STV data gracefully", async () => {
    // Test with a valid contest but expect missing data error
    const component = await ContestPage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
      }),
    });
    const { container } = render(component);

    // Should render error state when STV data is not available
    expect(container).toBeTruthy();

    // Check for error state content
    const content = container.textContent;
    expect(
      content?.includes("Contest Not Available") ||
        content?.includes("STV Rounds") ||
        content?.includes("Error"),
    ).toBe(true);
  });

  it("should handle invalid election gracefully", async () => {
    const component = await ContestPage({
      params: Promise.resolve({
        electionId: "invalid-election",
        contestId: "d2-3seat",
      }),
    });
    const { container } = render(component);

    // Should render error state for invalid election
    expect(container).toBeTruthy();
    const content = container.textContent;
    expect(
      content?.includes("Contest Not Available") || content?.includes("Error"),
    ).toBe(true);
  });

  it("should handle invalid contest gracefully", async () => {
    const component = await ContestPage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "invalid-contest",
      }),
    });
    const { container } = render(component);

    // Should render error state for invalid contest
    expect(container).toBeTruthy();
    const content = container.textContent;
    expect(
      content?.includes("Contest Not Available") || content?.includes("Error"),
    ).toBe(true);
  });
});
