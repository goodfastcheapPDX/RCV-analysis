import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RankDistributionCard } from "@/components/candidate/RankDistributionCard";
import { createOutputFixture } from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";

// Generate test data using contract fixtures
const candidateId = 42;
const mockCandidateData = [
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 1,
    count: 1250,
    pct_all_ballots: 0.35,
    pct_among_rankers: 0.42,
  }),
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 2,
    count: 890,
    pct_all_ballots: 0.25,
    pct_among_rankers: 0.3,
  }),
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 3,
    count: 534,
    pct_all_ballots: 0.15,
    pct_among_rankers: 0.18,
  }),
];

const mockZeroRankData = [
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 1,
    count: 0,
    pct_all_ballots: 0,
    pct_among_rankers: 0,
  }),
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 2,
    count: 0,
    pct_all_ballots: 0,
    pct_among_rankers: 0,
  }),
];

describe("RankDistributionCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render chart with data", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ALICE HARDESTY"
        data={mockCandidateData}
      />,
    );

    expect(container.textContent).toContain("Rank Distribution");
    expect(container.textContent).toContain(
      "Visual breakdown of ranking patterns for ALICE HARDESTY",
    );
    expect(container.textContent).toContain("rank_distribution_by_candidate");
    // Check for actual chart elements instead of mocked test IDs
    expect(container.querySelector("[data-chart]")).toBeInTheDocument();
  });

  it("should show empty state for zero-rank candidate", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ZERO RANK CANDIDATE"
        data={mockZeroRankData}
      />,
    );

    expect(container.textContent).toContain("No Ranking Data");
    expect(container.textContent).toContain(
      "This candidate was never ranked on any ballot.",
    );
    expect(container.querySelector("[data-chart]")).not.toBeInTheDocument();
  });

  it("should render toggle buttons for metric selection", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ALICE TOGGLE TEST"
        data={mockCandidateData}
      />,
    );

    expect(container.textContent).toContain("% of All Ballots");
    expect(container.textContent).toContain("% Among Rankers");
  });

  it("should toggle between metrics when buttons are clicked", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ALICE TOGGLE CLICK TEST"
        data={mockCandidateData}
      />,
    );

    // Find toggle buttons within this specific container
    const toggles = container.querySelectorAll("button[aria-pressed]");
    expect(toggles.length).toBe(2);

    const allBallotsToggle = Array.from(toggles).find((btn) =>
      btn.textContent?.includes("% of All Ballots"),
    ) as HTMLElement;
    const amongRankersToggle = Array.from(toggles).find((btn) =>
      btn.textContent?.includes("% Among Rankers"),
    ) as HTMLElement;

    expect(allBallotsToggle).toBeTruthy();
    expect(amongRankersToggle).toBeTruthy();

    // Initially, "% of All Ballots" should be pressed (default)
    expect(allBallotsToggle).toHaveAttribute("aria-pressed", "true");
    expect(amongRankersToggle).toHaveAttribute("aria-pressed", "false");

    // Click "% Among Rankers"
    fireEvent.click(amongRankersToggle);

    expect(allBallotsToggle).toHaveAttribute("aria-pressed", "false");
    expect(amongRankersToggle).toHaveAttribute("aria-pressed", "true");

    // Click back to "% of All Ballots"
    fireEvent.click(allBallotsToggle);

    expect(allBallotsToggle).toHaveAttribute("aria-pressed", "true");
    expect(amongRankersToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("should handle empty data array", () => {
    const { container } = render(
      <RankDistributionCard candidateName="EMPTY DATA" data={[]} />,
    );

    expect(container.textContent).toContain("No Ranking Data");
  });

  it("should display candidate name in multiple places", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="TEST CANDIDATE NAME"
        data={mockCandidateData}
      />,
    );

    // In the description
    expect(container.textContent).toContain(
      "Visual breakdown of ranking patterns for TEST CANDIDATE NAME",
    );
  });

  it("should handle very long candidate names gracefully", () => {
    const longName = "ALICE MARIE HARDESTY-JOHNSON-WILLIAMSON-SMITH";
    const { container } = render(
      <RankDistributionCard
        candidateName={longName}
        data={mockCandidateData}
      />,
    );

    expect(container.textContent).toContain(
      `Visual breakdown of ranking patterns for ${longName}`,
    );
  });
});
