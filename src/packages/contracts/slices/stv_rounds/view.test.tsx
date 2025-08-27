import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "./index.contract";
import { StvRoundsView } from "./view";

describe("StvRoundsView", () => {
  const sampleRoundsData: StvRoundsOutput[] = [
    { round: 1, candidate_name: "TestAlice", votes: 4, status: "standing" },
    { round: 1, candidate_name: "TestBob", votes: 3, status: "elected" },
  ];

  const sampleMetaData: StvMetaOutput[] = [
    {
      round: 1,
      quota: 3,
      exhausted: 0,
      elected_this_round: ["TestBob"],
      eliminated_this_round: null,
    },
  ];

  const sampleStats: StvRoundsStats = {
    number_of_rounds: 1,
    winners: ["TestBob"],
    seats: 1,
    first_round_quota: 3,
    precision: 0.000001,
  };

  it("renders component without crashing", () => {
    const { container } = render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={sampleMetaData}
        stats={sampleStats}
      />,
    );

    expect(container).toBeDefined();
    expect(container.textContent).toContain("STV Election Results");
    expect(container.textContent).toContain("TestAlice");
    expect(container.textContent).toContain("TestBob");
  });

  it("handles empty data", () => {
    const emptyStats: StvRoundsStats = {
      number_of_rounds: 1,
      winners: [],
      seats: 1,
      first_round_quota: 1,
      precision: 0.000001,
    };

    const { container } = render(
      <StvRoundsView
        roundsData={[]}
        metaData={[
          {
            round: 1,
            quota: 1,
            exhausted: 0,
            elected_this_round: null,
            eliminated_this_round: null,
          },
        ]}
        stats={emptyStats}
      />,
    );

    expect(container.textContent).toContain("STV Election Results");
  });
});
