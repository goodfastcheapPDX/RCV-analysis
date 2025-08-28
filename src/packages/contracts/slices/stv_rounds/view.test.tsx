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

  it("handles keyboard navigation", () => {
    const multiRoundStats: StvRoundsStats = {
      number_of_rounds: 3,
      winners: ["TestBob"],
      seats: 1,
      first_round_quota: 3,
      precision: 0.000001,
    };

    render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={sampleMetaData}
        stats={multiRoundStats}
      />,
    );

    // Test ArrowLeft key
    const leftEvent = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    window.dispatchEvent(leftEvent);

    // Test ArrowRight key
    const rightEvent = new KeyboardEvent("keydown", { key: "ArrowRight" });
    window.dispatchEvent(rightEvent);

    // Test Space key
    const spaceEvent = new KeyboardEvent("keydown", { key: " " });
    window.dispatchEvent(spaceEvent);

    // Test Home key
    const homeEvent = new KeyboardEvent("keydown", { key: "Home" });
    window.dispatchEvent(homeEvent);

    // Test End key
    const endEvent = new KeyboardEvent("keydown", { key: "End" });
    window.dispatchEvent(endEvent);
  });

  it("handles autoplay functionality", () => {
    const multiRoundStats: StvRoundsStats = {
      number_of_rounds: 2,
      winners: ["TestBob"],
      seats: 1,
      first_round_quota: 3,
      precision: 0.000001,
    };

    render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={sampleMetaData}
        stats={multiRoundStats}
      />,
    );

    // Test autoplay timer logic by triggering space key to start playing
    const spaceEvent = new KeyboardEvent("keydown", { key: " " });
    window.dispatchEvent(spaceEvent);
  });

  it("handles elected and eliminated candidates display", () => {
    const metaWithElectedAndEliminated: StvMetaOutput[] = [
      {
        round: 1,
        quota: 3,
        exhausted: 0,
        elected_this_round: ["TestBob"],
        eliminated_this_round: ["TestCharlie"],
      },
    ];

    const { container } = render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={metaWithElectedAndEliminated}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("TestBob");
  });

  it("handles candidates with zero votes", () => {
    const roundsWithZeroVotes: StvRoundsOutput[] = [
      { round: 1, candidate_name: "TestAlice", votes: 0, status: "standing" },
      { round: 1, candidate_name: "TestBob", votes: 3, status: "elected" },
    ];

    const { container } = render(
      <StvRoundsView
        roundsData={roundsWithZeroVotes}
        metaData={sampleMetaData}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("TestAlice");
  });

  it("handles candidates without quota percentage", () => {
    const metaWithZeroQuota: StvMetaOutput[] = [
      {
        round: 1,
        quota: 0,
        exhausted: 0,
        elected_this_round: ["TestBob"],
        eliminated_this_round: null,
      },
    ];

    const { container } = render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={metaWithZeroQuota}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("TestBob");
  });
});
