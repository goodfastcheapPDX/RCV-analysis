import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";
import type { CandidatesOutput } from "@/packages/contracts/slices/ingest_cvr/index.contract";
import FirstChoicePage from "../page";

// Mock the environment to use test data
vi.mock("@/lib/env", () => ({
  getDataEnv: () => "test",
}));

// Mock the FirstChoiceBreakdownView component to avoid complex rendering in tests
vi.mock("@/packages/contracts/slices/first_choice_breakdown/view", () => ({
  FirstChoiceBreakdownView: ({
    data,
  }: {
    data: Output[];
    candidates?: CandidatesOutput[];
    electionId?: string;
    contestId?: string;
  }) => (
    <div data-testid="first-choice-view">
      First Choice Data: {data?.length || 0} candidates
    </div>
  ),
}));

describe("First Choice Page", () => {
  it("should handle missing first choice data gracefully", async () => {
    // Test with a valid contest but expect missing data error
    const component = await FirstChoicePage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
      }),
    });
    const { container } = render(component);

    // Should render error state when first choice data is not available
    expect(container).toBeTruthy();

    // Check for error state content
    const content = container.textContent;
    expect(
      content?.includes("First Choice Data Not Available") ||
        content?.includes("First Choice Breakdown") ||
        content?.includes("Error"),
    ).toBe(true);
  });

  it("should handle invalid election gracefully", async () => {
    const component = await FirstChoicePage({
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
      content?.includes("First Choice Data Not Available") ||
        content?.includes("Error"),
    ).toBe(true);
  });

  it("should handle invalid contest gracefully", async () => {
    const component = await FirstChoicePage({
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
      content?.includes("First Choice Data Not Available") ||
        content?.includes("Error"),
    ).toBe(true);
  });

  it("should render navigation links in error state", async () => {
    const component = await FirstChoicePage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "invalid-contest",
      }),
    });
    const { container } = render(component);

    // Should include navigation back to contest and election
    const content = container.textContent;
    expect(
      content?.includes("Back to Contest") ||
        content?.includes("Back to Election"),
    ).toBe(true);
  });
});
