import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createStvMetaOutputFixture,
  createStvRoundsOutputFixture,
  createStvRoundsStatsFixture,
} from "@/contracts/slices/stv_rounds/index.contract";
import { createOutputFixture as createTransferFixture } from "@/contracts/slices/transfer_matrix/index.contract";
import { ChordChartView } from "./chord-chart-view";

describe("ChordChartView", () => {
  it("renders without crashing with valid data", () => {
    const transferData = [
      createTransferFixture({
        round: 2,
        from_candidate_name: "Alice Johnson",
        to_candidate_name: "Bob Smith",
        vote_count: 100,
      }),
      createTransferFixture({
        round: 2,
        from_candidate_name: "Alice Johnson",
        to_candidate_name: null, // exhausted
        vote_count: 50,
      }),
    ];

    const roundsData = [
      createStvRoundsOutputFixture({
        round: 2,
        candidate_name: "Alice Johnson",
        votes: 0,
        status: "eliminated",
      }),
      createStvRoundsOutputFixture({
        round: 2,
        candidate_name: "Bob Smith",
        votes: 150,
        status: "standing",
      }),
    ];

    const metaData = [
      createStvMetaOutputFixture({
        round: 2,
        quota: 1000,
        exhausted: 50,
      }),
    ];

    const stats = createStvRoundsStatsFixture();

    render(
      <ChordChartView
        transferData={transferData}
        roundsData={roundsData}
        metaData={metaData}
        stats={stats}
      />,
    );

    expect(screen.getByText("Round 2 of 2")).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) =>
          content.includes("Total Transfers") && content.includes("150"),
      ),
    ).toBeInTheDocument();
  });

  it("shows no data message when no transfers exist", () => {
    render(
      <ChordChartView
        transferData={[]}
        roundsData={[]}
        metaData={[]}
        stats={createStvRoundsStatsFixture()}
      />,
    );

    // Should show some indication that no data is available
    expect(screen.getByText(/No transfer data available/)).toBeInTheDocument();
  });
});
