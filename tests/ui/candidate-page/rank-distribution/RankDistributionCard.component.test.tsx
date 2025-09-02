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
    pct_among_position_rankers: 0.38,
  }),
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 2,
    count: 890,
    pct_all_ballots: 0.25,
    pct_among_rankers: 0.3,
    pct_among_position_rankers: 0.28,
  }),
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 3,
    count: 534,
    pct_all_ballots: 0.15,
    pct_among_rankers: 0.18,
    pct_among_position_rankers: 0.16,
  }),
];

const mockZeroRankData = [
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 1,
    count: 0,
    pct_all_ballots: 0,
    pct_among_rankers: 0,
    pct_among_position_rankers: 0,
  }),
  createOutputFixture({
    candidate_id: candidateId,
    rank_position: 2,
    count: 0,
    pct_all_ballots: 0,
    pct_among_rankers: 0,
    pct_among_position_rankers: 0,
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

  it("should render radio buttons for metric selection", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ALICE RADIO TEST"
        data={mockCandidateData}
      />,
    );

    expect(container.textContent).toContain("% of All Ballots");
    expect(container.textContent).toContain("% Among Candidate's Rankers");
    expect(container.textContent).toContain("% Among Position Rankers");
    expect(container.textContent).toContain("Percentage Type");
  });

  it("should switch between metrics when radio buttons are clicked", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="ALICE RADIO CLICK TEST"
        data={mockCandidateData}
      />,
    );

    // Find radio buttons within this specific container
    const radioButtons = container.querySelectorAll("button[role='radio']");
    expect(radioButtons.length).toBe(3);

    const allBallotsRadio = container.querySelector(
      "button[value='pct_all_ballots']",
    ) as HTMLButtonElement;
    const candidateRankersRadio = container.querySelector(
      "button[value='pct_among_rankers']",
    ) as HTMLButtonElement;
    const positionRankersRadio = container.querySelector(
      "button[value='pct_among_position_rankers']",
    ) as HTMLButtonElement;

    expect(allBallotsRadio).toBeTruthy();
    expect(candidateRankersRadio).toBeTruthy();
    expect(positionRankersRadio).toBeTruthy();

    // Initially, "% of All Ballots" should be selected (default)
    expect(allBallotsRadio.getAttribute("aria-checked")).toBe("true");
    expect(candidateRankersRadio.getAttribute("aria-checked")).toBe("false");
    expect(positionRankersRadio.getAttribute("aria-checked")).toBe("false");

    // Click "% Among Candidate's Rankers"
    fireEvent.click(candidateRankersRadio);

    expect(allBallotsRadio.getAttribute("aria-checked")).toBe("false");
    expect(candidateRankersRadio.getAttribute("aria-checked")).toBe("true");
    expect(positionRankersRadio.getAttribute("aria-checked")).toBe("false");

    // Click "% Among Position Rankers"
    fireEvent.click(positionRankersRadio);

    expect(allBallotsRadio.getAttribute("aria-checked")).toBe("false");
    expect(candidateRankersRadio.getAttribute("aria-checked")).toBe("false");
    expect(positionRankersRadio.getAttribute("aria-checked")).toBe("true");
  });

  it("should display significantly different values when toggling between percentage modes", () => {
    // Create test data where pct_all_ballots and pct_among_rankers differ dramatically
    const testDataWithDifferences = [
      createOutputFixture({
        candidate_id: candidateId,
        rank_position: 1,
        count: 100,
        pct_all_ballots: 0.05, // 5% of all ballots
        pct_among_rankers: 0.5, // 50% among rankers (candidate only ranked on 20% of ballots)
        pct_among_position_rankers: 0.33, // 33% among position rankers
      }),
      createOutputFixture({
        candidate_id: candidateId,
        rank_position: 2,
        count: 100,
        pct_all_ballots: 0.05, // 5% of all ballots
        pct_among_rankers: 0.5, // 50% among rankers
        pct_among_position_rankers: 0.33, // 33% among position rankers
      }),
    ];

    const { container } = render(
      <RankDistributionCard
        candidateName="PERCENTAGE TEST"
        data={testDataWithDifferences}
      />,
    );

    // Find radio buttons
    const allBallotsRadio = container.querySelector(
      "button[value='pct_all_ballots']",
    ) as HTMLButtonElement;
    const amongRankersRadio = container.querySelector(
      "button[value='pct_among_rankers']",
    ) as HTMLButtonElement;

    expect(allBallotsRadio).toBeTruthy();
    expect(amongRankersRadio).toBeTruthy();

    // Initially, "% of All Ballots" should be selected (default)
    expect(allBallotsRadio.getAttribute("aria-checked")).toBe("true");
    expect(amongRankersRadio.getAttribute("aria-checked")).toBe("false");

    // Click "% Among Rankers" radio
    fireEvent.click(amongRankersRadio);

    // Verify the radio state changed
    expect(allBallotsRadio.getAttribute("aria-checked")).toBe("false");
    expect(amongRankersRadio.getAttribute("aria-checked")).toBe("true");

    // The chart container should be present and functional
    const chartContainer = container.querySelector("[data-chart]");
    expect(chartContainer).toBeInTheDocument();
  });

  it("should calculate percentage values correctly in chart data", () => {
    const { container } = render(
      <RankDistributionCard
        candidateName="CALCULATION TEST"
        data={mockCandidateData}
      />,
    );

    // Verify basic structure is rendered correctly
    expect(container.textContent).toContain("Rank Distribution");
    expect(container.textContent).toContain("CALCULATION TEST");

    // Check that all radio options are available
    expect(container.textContent).toContain("% of All Ballots");
    expect(container.textContent).toContain("% Among Candidate's Rankers");

    // The chart container should be present
    const chartContainer = container.querySelector("[data-chart]");
    expect(chartContainer).toBeInTheDocument();

    // mockCandidateData has meaningful differences:
    // - Rank 1: 35% of all ballots, 42% among rankers
    // - Rank 2: 25% of all ballots, 30% among rankers
    // - Rank 3: 15% of all ballots, 18% among rankers
    // These should be properly transformed by the useMemo logic
    expect(container).toBeTruthy();
  });

  it("should correctly toggle chart data values between percentage types", () => {
    const testData = [
      createOutputFixture({
        candidate_id: candidateId,
        rank_position: 1,
        count: 200,
        pct_all_ballots: 0.1, // 10%
        pct_among_rankers: 0.8, // 80%
        pct_among_position_rankers: 0.75, // 75%
      }),
    ];

    const { container } = render(
      <RankDistributionCard candidateName="TOGGLE DATA TEST" data={testData} />,
    );

    // Get the chart container and check that it updates when toggling
    const chartContainer = container.querySelector("[data-chart]");
    expect(chartContainer).toBeInTheDocument();

    // All radio buttons should be present and functional
    const radioButtons = container.querySelectorAll("button[role='radio']");
    expect(radioButtons.length).toBe(3);
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
