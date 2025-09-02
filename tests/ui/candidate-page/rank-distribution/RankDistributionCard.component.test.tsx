import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankDistributionCard } from "@/components/candidate/RankDistributionCard";

// Only mock the skeleton component to avoid rendering complexity
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

const mockCandidateData = [
  {
    rank: 1,
    count: 1250,
    pct_all_ballots: 0.35,
    pct_among_rankers: 0.42,
  },
  {
    rank: 2,
    count: 890,
    pct_all_ballots: 0.25,
    pct_among_rankers: 0.3,
  },
  {
    rank: 3,
    count: 534,
    pct_all_ballots: 0.15,
    pct_among_rankers: 0.18,
  },
];

const mockZeroRankData = [
  {
    rank: 1,
    count: 0,
    pct_all_ballots: 0,
    pct_among_rankers: 0,
  },
  {
    rank: 2,
    count: 0,
    pct_all_ballots: 0,
    pct_among_rankers: 0,
  },
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

  it("should show loading state with skeletons", () => {
    const { container } = render(
      <RankDistributionCard candidateName="LOADING CANDIDATE" loading={true} />,
    );

    expect(container.textContent).toContain("Rank Distribution");
    expect(container.textContent).toContain(
      "Visual breakdown of ranking patterns for LOADING CANDIDATE",
    );
    // Check for skeleton elements - there should be at least one
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should show error state with retry button", () => {
    const mockRetry = vi.fn();
    const { container } = render(
      <RankDistributionCard
        candidateName="ERROR CANDIDATE"
        error="Data not available"
        onRetry={mockRetry}
      />,
    );

    expect(container.textContent).toContain("Data Unavailable");
    expect(container.textContent).toContain("Data not available");

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("should show error state without retry button when onRetry not provided", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ERROR CANDIDATE NO RETRY"
        error="Data not available"
      />,
    );

    expect(container.textContent).toContain("Data Unavailable");
    // Check that there's no retry text in this specific container
    expect(container.textContent).not.toContain("Retry");
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
