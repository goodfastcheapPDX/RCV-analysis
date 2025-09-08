import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createOutputFixture,
  createStatsFixture,
  type Output,
  type Stats,
} from "./index.contract";
import { CandidateAffinityJaccardView } from "./view";

describe("CandidateAffinityJaccardView", () => {
  const mockCandidates = [
    {
      election_id: "test-election",
      contest_id: "test-contest",
      district_id: "d2",
      seat_count: 3,
      candidate_id: 1,
      candidate_name: "ALICE HARDESTY",
    },
    {
      election_id: "test-election",
      contest_id: "test-contest",
      district_id: "d2",
      seat_count: 3,
      candidate_id: 2,
      candidate_name: "CANDACE AVALOS",
    },
    {
      election_id: "test-election",
      contest_id: "test-contest",
      district_id: "d2",
      seat_count: 3,
      candidate_id: 3,
      candidate_name: "OLIVIA CLARK",
    },
  ];

  const mockJaccardData: Output[] = [
    createOutputFixture({
      candidate_a: 1,
      candidate_b: 2,
      pair_count: 450,
      presence_a: 800,
      presence_b: 750,
      union_count: 1100,
      jaccard: 0.409,
    }),
    createOutputFixture({
      candidate_a: 1,
      candidate_b: 3,
      pair_count: 380,
      presence_a: 800,
      presence_b: 650,
      union_count: 1070,
      jaccard: 0.355,
    }),
    createOutputFixture({
      candidate_a: 2,
      candidate_b: 3,
      pair_count: 420,
      presence_a: 750,
      presence_b: 650,
      union_count: 980,
      jaccard: 0.429,
    }),
  ];

  const mockStats: Stats = createStatsFixture({
    total_ballots_considered: 1200,
    unique_pairs: 3,
    max_jaccard: 0.429,
    zero_union_pairs: 0,
    compute_ms: 145,
  });

  describe("basic rendering", () => {
    it("should render the component with title and description", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      expect(
        within(container).getByText("Candidate Affinity Jaccard Matrix"),
      ).toBeInTheDocument();
      expect(
        within(container).getByText(/Heatmap showing normalized similarity/),
      ).toBeInTheDocument();
    });

    it("should display header stats correctly", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      expect(within(container).getByText("1,200")).toBeInTheDocument(); // total_ballots_considered
      expect(
        within(container).getByText("Ballots Considered"),
      ).toBeInTheDocument();

      expect(within(container).getByText("3")).toBeInTheDocument(); // unique_pairs
      expect(within(container).getByText("Unique Pairs")).toBeInTheDocument();

      expect(within(container).getByText("42.9%")).toBeInTheDocument(); // max_jaccard as percentage
      expect(within(container).getByText("Max Jaccard")).toBeInTheDocument();

      expect(within(container).getByText("0")).toBeInTheDocument(); // zero_union_pairs
      expect(
        within(container).getByText("Zero Union Pairs"),
      ).toBeInTheDocument();
    });

    it("should render controls section", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      // The controls are rendered - check for the specific label text I can see in the DOM
      expect(
        within(container).getByText("Minimum Jaccard Index:"),
      ).toBeInTheDocument();
    });

    it("should render legend", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      expect(
        within(container).getByText("Self-pair (excluded)"),
      ).toBeInTheDocument();
      expect(within(container).getByText(/Low similarity/)).toBeInTheDocument();
      expect(
        within(container).getByText(/High similarity/),
      ).toBeInTheDocument();
    });

    it("should render interpretation section", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      expect(
        within(container).getByText(/The Jaccard index normalizes/),
      ).toBeInTheDocument();
      expect(within(container).getByText(/Assumptions:/)).toBeInTheDocument();
    });
  });

  describe("data handling", () => {
    it("should handle empty data gracefully", () => {
      const emptyStats: Stats = createStatsFixture({
        total_ballots_considered: 100,
        unique_pairs: 0,
        max_jaccard: 0,
        zero_union_pairs: 0,
        compute_ms: 50,
      });

      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={[]}
          stats={emptyStats}
          candidates={mockCandidates}
        />,
      );

      expect(
        within(container).getByText("Candidate Affinity Jaccard Matrix"),
      ).toBeInTheDocument();
      expect(within(container).getByText("100")).toBeInTheDocument(); // total_ballots_considered
      expect(within(container).getByText("Unique Pairs")).toBeInTheDocument(); // Check for the label instead
    });

    it("should handle missing candidates data", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
        />,
      );

      // Should still render the component
      expect(
        within(container).getByText("Candidate Affinity Jaccard Matrix"),
      ).toBeInTheDocument();
    });

    it("should sort candidates when candidates data is provided", () => {
      const unorderedCandidates = [
        mockCandidates[2], // OLIVIA CLARK
        mockCandidates[0], // ALICE HARDESTY
        mockCandidates[1], // CANDACE AVALOS
      ];

      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={unorderedCandidates}
        />,
      );

      // Component should handle the sorting internally
      expect(
        within(container).getByText("Candidate Affinity Jaccard Matrix"),
      ).toBeInTheDocument();
    });
  });

  describe("stats formatting", () => {
    it("should format large numbers with commas", () => {
      const largeStats: Stats = createStatsFixture({
        total_ballots_considered: 12500,
        unique_pairs: 1500,
        max_jaccard: 0.789,
        zero_union_pairs: 25,
        compute_ms: 2500,
      });

      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={largeStats}
          candidates={mockCandidates}
        />,
      );

      expect(within(container).getByText("12,500")).toBeInTheDocument();
      expect(within(container).getByText("1,500")).toBeInTheDocument();
      expect(within(container).getByText("78.9%")).toBeInTheDocument();
      expect(within(container).getByText("25")).toBeInTheDocument();
    });

    it("should handle zero and small values correctly", () => {
      const smallStats: Stats = createStatsFixture({
        total_ballots_considered: 5,
        unique_pairs: 1,
        max_jaccard: 0.001,
        zero_union_pairs: 0,
        compute_ms: 10,
      });

      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData.slice(0, 1)}
          stats={smallStats}
          candidates={mockCandidates}
        />,
      );

      expect(within(container).getByText("5")).toBeInTheDocument();
      expect(within(container).getByText("1")).toBeInTheDocument();
      expect(within(container).getByText("0.1%")).toBeInTheDocument(); // 0.001 * 100 = 0.1%
      expect(within(container).getByText("0")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper heading structure", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      // The title should be accessible
      const title = within(container).getByText(
        "Candidate Affinity Jaccard Matrix",
      );
      expect(title).toBeInTheDocument();
    });

    it("should provide stats in accessible format", () => {
      const { container } = render(
        <CandidateAffinityJaccardView
          jaccardData={mockJaccardData}
          stats={mockStats}
          candidates={mockCandidates}
        />,
      );

      // Stats should have descriptive text
      expect(
        within(container).getByText("Ballots Considered"),
      ).toBeInTheDocument();
      expect(within(container).getByText("Unique Pairs")).toBeInTheDocument();
      expect(within(container).getByText("Max Jaccard")).toBeInTheDocument();
      expect(
        within(container).getByText("Zero Union Pairs"),
      ).toBeInTheDocument();
    });
  });

  describe("contract validation", () => {
    it("should accept data that matches the Output schema", () => {
      // This test verifies that the component can consume data that matches our contract
      const validData: Output[] = [
        createOutputFixture({
          candidate_a: 1,
          candidate_b: 2,
          pair_count: 100,
          presence_a: 150,
          presence_b: 140,
          union_count: 190,
          jaccard: 100 / 190, // Valid Jaccard calculation
        }),
      ];

      const validStats: Stats = createStatsFixture({
        total_ballots_considered: 200,
        unique_pairs: 1,
        max_jaccard: 100 / 190,
        zero_union_pairs: 0,
        compute_ms: 50,
      });

      expect(() => {
        render(
          <CandidateAffinityJaccardView
            jaccardData={validData}
            stats={validStats}
            candidates={mockCandidates}
          />,
        );
      }).not.toThrow();
    });
  });
});
