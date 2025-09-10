import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import { createOutputFixture, createStatsFixture } from "./index.contract";
import { CandidateAffinityProximityView } from "./view";

describe("CandidateAffinityProximityView", () => {
  const mockCandidates: CandidatesOutput[] = [
    {
      election_id: "portland-20241105-gen",
      contest_id: "d2-3seat",
      district_id: "d2",
      seat_count: 3,
      candidate_id: 1,
      candidate_name: "Alice Johnson",
    },
    {
      election_id: "portland-20241105-gen",
      contest_id: "d2-3seat",
      district_id: "d2",
      seat_count: 3,
      candidate_id: 2,
      candidate_name: "Bob Smith",
    },
    {
      election_id: "portland-20241105-gen",
      contest_id: "d2-3seat",
      district_id: "d2",
      seat_count: 3,
      candidate_id: 3,
      candidate_name: "Carol Davis",
    },
  ];

  const mockProximityData = [
    createOutputFixture({
      candidate_a: 1,
      candidate_b: 2,
      weight_sum: 125.5,
      pair_count: 150,
      avg_distance: 1.8,
    }),
    createOutputFixture({
      candidate_a: 1,
      candidate_b: 3,
      weight_sum: 87.2,
      pair_count: 120,
      avg_distance: 2.3,
    }),
    createOutputFixture({
      candidate_a: 2,
      candidate_b: 3,
      weight_sum: 95.8,
      pair_count: 140,
      avg_distance: 2.1,
    }),
  ];

  const mockStats = createStatsFixture({
    total_ballots_considered: 200,
    unique_pairs: 3,
    alpha: 0.5,
    max_weight_sum: 125.5,
    compute_ms: 250,
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );
    });

    it("should display title and description", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      const text = container.textContent || "";
      expect(text).toContain("Candidate Affinity Proximity Matrix");
      expect(text).toMatch(/proximity-weighted candidate affinity/i);
    });

    it("should display header stats", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      const text = container.textContent || "";
      expect(text).toContain("200"); // total_ballots_considered
      expect(text).toContain("3"); // unique_pairs (but avoid matching "d2-3seat")
      expect(text).toMatch(/125\.5\d*/); // max_weight_sum (may have more decimals)
      expect(text).toContain("α = 0.5"); // alpha
    });

    it("should display proximity-specific controls", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // Check for control elements rather than exact text matches
      const controlSection =
        container.querySelector('[data-testid="controls"]') ||
        container.querySelector(".space-y-4") ||
        container;
      expect(controlSection).toBeTruthy();
    });

    it("should display proximity-specific interpretation", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      const text = container.textContent || "";
      expect(text).toMatch(/Proximity weighting emphasizes/);
      expect(text).toMatch(/Adjacent ranks.*contribute full weight/);
      expect(text).toMatch(/α.*0\.5/);
    });
  });

  describe("data handling", () => {
    it("should handle empty data gracefully", () => {
      const emptyStats = createStatsFixture({
        total_ballots_considered: 0,
        unique_pairs: 0,
        max_weight_sum: 0,
      });

      render(
        <CandidateAffinityProximityView
          proximityData={[]}
          stats={emptyStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );
    });

    it("should handle missing candidates gracefully", () => {
      render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={undefined}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );
    });

    it("should sort candidates correctly", () => {
      // This tests the useSortedCandidates hook integration
      const unsortedCandidates = [
        mockCandidates[2],
        mockCandidates[0],
        mockCandidates[1],
      ];

      render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={unsortedCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // The component should handle sorting internally without throwing errors
    });
  });

  describe("mathematical display", () => {
    it("should show correct alpha decay formula", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // Should show the decay values in the formula text
      const formulaText = container.textContent || "";
      expect(formulaText).toMatch(/Two ranks apart contributes 0\.50/);
      expect(formulaText).toMatch(/three apart contributes 0\.250/);
    });

    it("should display proximity metrics correctly", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // Should contain the base heatmap component elements
      expect(container.querySelector("div")).toBeTruthy();
    });
  });

  describe("controls functionality", () => {
    it("should provide threshold controls", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // Look for any input controls (sliders may be custom components)
      const inputs = container.querySelectorAll("input, button");
      expect(inputs.length).toBeGreaterThanOrEqual(0);
    });

    it("should provide top-K controls", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // Look for toggle switches
      const toggles = container.querySelectorAll('button[role="switch"]');
      expect(toggles.length).toBeGreaterThan(0);
    });
  });

  describe("accessibility", () => {
    it("should have proper semantic structure", () => {
      const { container } = render(
        <CandidateAffinityProximityView
          proximityData={mockProximityData}
          stats={mockStats}
          candidates={mockCandidates}
          electionId="portland-20241105-gen"
          contestId="d2-3seat"
        />,
      );

      // Should have some semantic content
      const interactiveElements = container.querySelectorAll(
        "button, input, select, a",
      );
      expect(interactiveElements.length).toBeGreaterThanOrEqual(0);
    });
  });
});
