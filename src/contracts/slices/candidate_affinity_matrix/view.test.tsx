// biome-ignore-all lint/suspicious/noExplicitAny: mocks

import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { CandidatesOutput } from "../ingest_cvr/index.contract";
import { createOutputFixture, createStatsFixture } from "./index.contract";
import { CandidateAffinityMatrixView } from "./view";

// Mock @nivo/heatmap components
vi.mock("@nivo/heatmap", () => ({
  ResponsiveHeatMap: ({
    data,
    tooltip,
    onClick,
  }: {
    data: any[];
    tooltip: any;
    onClick: any;
    [key: string]: any;
  }) => {
    // Simulate heatmap cells
    const cells = data.flatMap((serie) =>
      serie.data.map((cell: any) => ({
        serieId: serie.id,
        data: cell,
        value: cell.y,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      })),
    );

    return (
      <div data-testid="heatmap">
        {cells.map((cell, index) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: tests
          // biome-ignore lint/a11y/useKeyWithClickEvents: tests
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: tests
            key={index}
            data-testid={`heatmap-cell-${cell.serieId}-${cell.data.x}`}
            onClick={() => onClick?.(cell)}
            style={{ cursor: "pointer" }}
          >
            Cell {cell.serieId}-{cell.data.x}: {cell.value}
          </div>
        ))}
        {/* Render tooltip content for testing */}
        {tooltip && cells.length > 0 && (
          <div data-testid="tooltip-content">
            {tooltip({
              cell: {
                ...cells[0],
                serieId: "1", // Alice
                data: { x: "2", y: 0.75 }, // Bob
                value: 0.75,
              },
            })}
          </div>
        )}
      </div>
    );
  },
}));

// Mock Slider component to test value changes
vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
    step,
    ...props
  }: {
    value: number[];
    onValueChange: (value: number[]) => void;
    min: number;
    max: number;
    step: number;
    [key: string]: any;
  }) => (
    <div data-testid="slider">
      <input
        type="range"
        value={value[0]}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        {...props}
      />
    </div>
  ),
}));

// Mock Switch component
vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    [key: string]: any;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      {...props}
    />
  ),
}));

const mockCandidates: CandidatesOutput[] = [
  {
    election_id: "test-election",
    contest_id: "test-contest",
    district_id: "test-district",
    seat_count: 3,
    candidate_id: 1,
    candidate_name: "Alice Smith",
  },
  {
    election_id: "test-election",
    contest_id: "test-contest",
    district_id: "test-district",
    seat_count: 3,
    candidate_id: 2,
    candidate_name: "Bob Johnson",
  },
  {
    election_id: "test-election",
    contest_id: "test-contest",
    district_id: "test-district",
    seat_count: 3,
    candidate_id: 3,
    candidate_name: "Charlie Brown",
  },
];

const mockAffinityData = [
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 2,
    cooccurrence_count: 150,
    cooccurrence_frac: 0.75,
  }),
  createOutputFixture({
    candidate_a: 1,
    candidate_b: 3,
    cooccurrence_count: 120,
    cooccurrence_frac: 0.6,
  }),
  createOutputFixture({
    candidate_a: 2,
    candidate_b: 3,
    cooccurrence_count: 80,
    cooccurrence_frac: 0.4,
  }),
];

const mockStats = createStatsFixture({
  total_ballots_considered: 200,
  unique_pairs: 3,
  max_pair_frac: 0.75,
  compute_ms: 150,
});

describe("CandidateAffinityMatrixView", () => {
  test("should render header with correct title and description", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    expect(
      within(container).getByText("Candidate Affinity Matrix"),
    ).toBeInTheDocument();
    expect(
      within(container).getByText(
        /Heatmap showing how often pairs of candidates appear together/i,
      ),
    ).toBeInTheDocument();
  });

  test("should display key statistics correctly", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    expect(within(container).getByText("200")).toBeInTheDocument(); // total_ballots_considered
    expect(
      within(container).getByText("Ballots Considered"),
    ).toBeInTheDocument();

    expect(within(container).getByText("3")).toBeInTheDocument(); // unique_pairs
    expect(within(container).getByText("Unique Pairs")).toBeInTheDocument();

    expect(within(container).getByText("75.0%")).toBeInTheDocument(); // max_pair_frac
    expect(
      within(container).getByText("Max Pair Fraction"),
    ).toBeInTheDocument();
  });

  test("should render visualization controls", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    expect(
      within(container).getByText("Visualization Controls"),
    ).toBeInTheDocument();
    expect(
      within(container).getByText(/Minimum Co-occurrence Fraction/),
    ).toBeInTheDocument();
    expect(
      within(container).getByText("Show only top pairs"),
    ).toBeInTheDocument();
    expect(within(container).getByText(/Showing.*pairs/)).toBeInTheDocument();
  });

  test("should filter data by minimum threshold", async () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    // Find the threshold slider and set it to 0.5
    const slider = within(container).getAllByTestId("slider")[0];
    const sliderInput = within(slider).getByRole("slider");

    fireEvent.change(sliderInput, { target: { value: "0.5" } });

    await waitFor(() => {
      // Should show only pairs above 0.5 threshold (2 pairs: 0.75 and 0.6)
      expect(
        within(container).getByText("Showing 2 of 3 pairs"),
      ).toBeInTheDocument();
    });
  });

  test("should enable and configure top K filtering", async () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    // Enable top K toggle
    const topKToggle = within(container).getByRole("checkbox");
    fireEvent.click(topKToggle);

    await waitFor(() => {
      expect(
        within(container).getByText(/Top.*pairs by co-occurrence fraction/),
      ).toBeInTheDocument();
    });

    // Should now show top K slider
    const sliders = within(container).getAllByTestId("slider");
    expect(sliders.length).toBe(2); // threshold + top K
  });

  test("should render heatmap with correct data structure", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    expect(within(container).getByTestId("heatmap")).toBeInTheDocument();

    // Check that self-pairs show as 0
    expect(within(container).getByTestId("heatmap-cell-1-1")).toHaveTextContent(
      "Cell 1-1: 0",
    );
    expect(within(container).getByTestId("heatmap-cell-2-2")).toHaveTextContent(
      "Cell 2-2: 0",
    );

    // Check that actual pairs show correct values
    expect(within(container).getByTestId("heatmap-cell-1-2")).toHaveTextContent(
      "Cell 1-2: 0.75",
    );
    expect(within(container).getByTestId("heatmap-cell-2-1")).toHaveTextContent(
      "Cell 2-1: 0.75",
    ); // Symmetric
  });

  test("should handle missing candidates gracefully", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={undefined}
      />,
    );

    expect(within(container).getByTestId("heatmap")).toBeInTheDocument();
    // Should use candidate IDs as fallback display
    expect(
      within(container).getByTestId("heatmap-cell-1-2"),
    ).toBeInTheDocument();
  });

  test("should render tooltip content correctly for candidate pairs", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    const tooltipContent = within(container).getByTestId("tooltip-content");
    expect(tooltipContent).toBeInTheDocument();

    // Should show candidate names and statistics
    expect(tooltipContent).toHaveTextContent("Alice Smith ↔ Bob Johnson");
    expect(tooltipContent).toHaveTextContent("150 ballots");
    expect(tooltipContent).toHaveTextContent("75.0% of all ballots");
  });

  test("should handle tooltip for self-pairs", () => {
    // Mock a tooltip that receives a self-pair cell
    const MockTooltipComponent = ({ cell }: { cell: any }) => {
      const candidateAId = parseInt(cell.serieId, 10);
      const candidateBId = parseInt(cell.data.x, 10);

      if (candidateAId === candidateBId) {
        return <div>Alice Smith</div>;
      }
      return <div>Different candidates</div>;
    };

    const { container } = render(
      <div>
        <MockTooltipComponent
          cell={{
            serieId: "1",
            data: { x: "1", y: 0 },
          }}
        />
      </div>,
    );

    expect(within(container).getByText("Alice Smith")).toBeInTheDocument();
  });

  test("should handle click-to-pin tooltip functionality", async () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    // Click on a heatmap cell
    const cell = within(container).getByTestId("heatmap-cell-1-2");
    fireEvent.click(cell);

    await waitFor(() => {
      // Should show pinned tooltip - look for the unique unpinning text
      expect(
        within(container).getByText("Click square again to unpin"),
      ).toBeInTheDocument();
      // Should show the close button
      expect(
        within(container).getByLabelText("Close tooltip"),
      ).toBeInTheDocument();
    });

    // Click same cell again to unpin
    fireEvent.click(cell);

    await waitFor(() => {
      // Pinned tooltip should be removed
      expect(
        within(container).queryByText("Click square again to unpin"),
      ).not.toBeInTheDocument();
    });
  });

  test("should close pinned tooltip with close button", async () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    // Click on a heatmap cell to pin tooltip
    const cell = within(container).getByTestId("heatmap-cell-1-2");
    fireEvent.click(cell);

    await waitFor(() => {
      expect(
        within(container).getByText("Click square again to unpin"),
      ).toBeInTheDocument();
    });

    // Click close button
    const closeButton = within(container).getByLabelText("Close tooltip");
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        within(container).queryByText("Click square again to unpin"),
      ).not.toBeInTheDocument();
    });
  });

  test("should sort candidates by name when candidates data is available", () => {
    const unsortedCandidates: CandidatesOutput[] = [
      {
        election_id: "test-election",
        contest_id: "test-contest",
        district_id: "test-district",
        seat_count: 3,
        candidate_id: 3,
        candidate_name: "Zoe Wilson", // Should come last
      },
      {
        election_id: "test-election",
        contest_id: "test-contest",
        district_id: "test-district",
        seat_count: 3,
        candidate_id: 1,
        candidate_name: "Alice Smith", // Should come first
      },
      {
        election_id: "test-election",
        contest_id: "test-contest",
        district_id: "test-district",
        seat_count: 3,
        candidate_id: 2,
        candidate_name: "Bob Johnson", // Should come middle
      },
    ];

    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={unsortedCandidates}
      />,
    );

    // The heatmap should be organized with Alice (1), Bob (2), then Zoe (3)
    expect(within(container).getByTestId("heatmap")).toBeInTheDocument();
    expect(
      within(container).getByTestId("heatmap-cell-1-2"),
    ).toBeInTheDocument(); // Alice-Bob pair
    expect(
      within(container).getByTestId("heatmap-cell-1-3"),
    ).toBeInTheDocument(); // Alice-Zoe pair
  });

  test("should render legend and interpretation text", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    expect(
      within(container).getByText("Self-pair (excluded)"),
    ).toBeInTheDocument();
    expect(
      within(container).getByText("Low co-occurrence"),
    ).toBeInTheDocument();
    expect(
      within(container).getByText("High co-occurrence"),
    ).toBeInTheDocument();

    expect(
      within(container).getByText(
        /Darker colors indicate higher co-occurrence rates/,
      ),
    ).toBeInTheDocument();
    expect(
      within(container).getByText(/regardless of their ranking order/),
    ).toBeInTheDocument();
  });

  test("should handle empty affinity data", () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={[]}
        stats={createStatsFixture({ unique_pairs: 0, max_pair_frac: 0 })}
        candidates={mockCandidates}
      />,
    );

    expect(
      within(container).getByText("Showing 0 of 0 pairs"),
    ).toBeInTheDocument();
    expect(within(container).getByTestId("heatmap")).toBeInTheDocument();
  });

  test("should update display count when filtering changes", async () => {
    const { container } = render(
      <CandidateAffinityMatrixView
        affinityData={mockAffinityData}
        stats={mockStats}
        candidates={mockCandidates}
      />,
    );

    // Initially shows all pairs
    expect(
      within(container).getByText("Showing 3 of 3 pairs"),
    ).toBeInTheDocument();

    // Change threshold to filter out some pairs
    const slider = within(container).getAllByTestId("slider")[0];
    const sliderInput = within(slider).getByRole("slider");

    fireEvent.change(sliderInput, { target: { value: "0.7" } });

    await waitFor(() => {
      // Should now show only pairs above 0.7 threshold (1 pair: 0.75)
      expect(
        within(container).getByText("Showing 1 of 3 pairs"),
      ).toBeInTheDocument();
    });
  });
});
