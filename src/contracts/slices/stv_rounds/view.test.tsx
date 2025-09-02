import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createStvMetaOutputFixture,
  createStvRoundsOutputFixture,
  createStvRoundsStatsFixture,
  type StvMetaOutput,
  type StvRoundsOutput,
  type StvRoundsStats,
} from "./index.contract";
import { StvRoundsView } from "./view";

describe("StvRoundsView", () => {
  const sampleRoundsData: StvRoundsOutput[] = [
    createStvRoundsOutputFixture({
      candidate_name: "TestAlice",
      votes: 4,
      status: "standing",
    }),
    createStvRoundsOutputFixture({
      candidate_name: "TestBob",
      votes: 3,
      status: "elected",
    }),
  ];

  const sampleMetaData: StvMetaOutput[] = [
    createStvMetaOutputFixture({
      quota: 3,
      exhausted: 0,
      elected_this_round: ["TestBob"],
      eliminated_this_round: null,
    }),
  ];

  const sampleStats: StvRoundsStats = createStvRoundsStatsFixture({
    number_of_rounds: 1,
    winners: ["TestBob"],
    seats: 1,
    first_round_quota: 3,
  });

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
    const emptyStats: StvRoundsStats = createStvRoundsStatsFixture({
      number_of_rounds: 1,
      winners: [],
      seats: 1,
      first_round_quota: 1,
    });

    const { container } = render(
      <StvRoundsView
        roundsData={[]}
        metaData={[
          createStvMetaOutputFixture({
            quota: 1,
            exhausted: 0,
            elected_this_round: null,
            eliminated_this_round: null,
          }),
        ]}
        stats={emptyStats}
      />,
    );

    expect(container.textContent).toContain("STV Election Results");
  });

  it("handles keyboard navigation", () => {
    const multiRoundStats: StvRoundsStats = createStvRoundsStatsFixture({
      number_of_rounds: 3,
      winners: ["TestBob"],
      seats: 1,
      first_round_quota: 3,
    });

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
    const multiRoundStats: StvRoundsStats = createStvRoundsStatsFixture({
      number_of_rounds: 2,
      winners: ["TestBob"],
      seats: 1,
      first_round_quota: 3,
    });

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
      createStvMetaOutputFixture({
        quota: 3,
        exhausted: 0,
        elected_this_round: ["TestBob"],
        eliminated_this_round: ["TestCharlie"],
      }),
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
      createStvRoundsOutputFixture({
        candidate_name: "TestAlice",
        votes: 0,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        candidate_name: "TestBob",
        votes: 3,
        status: "elected",
      }),
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
      createStvMetaOutputFixture({
        quota: 0,
        exhausted: 0,
        elected_this_round: ["TestBob"],
        eliminated_this_round: null,
      }),
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

  it("handles complex multi-round election with eliminations", () => {
    const multiRoundRoundsData: StvRoundsOutput[] = [
      // Round 1
      createStvRoundsOutputFixture({
        round: 1,
        candidate_name: "Alice",
        votes: 100,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        round: 1,
        candidate_name: "Bob",
        votes: 150,
        status: "elected",
      }),
      createStvRoundsOutputFixture({
        round: 1,
        candidate_name: "Charlie",
        votes: 50,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        round: 1,
        candidate_name: "David",
        votes: 25,
        status: "standing",
      }),

      // Round 2 - David eliminated, votes transferred
      createStvRoundsOutputFixture({
        round: 2,
        candidate_name: "Alice",
        votes: 110,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        round: 2,
        candidate_name: "Bob",
        votes: 150,
        status: "elected",
      }),
      createStvRoundsOutputFixture({
        round: 2,
        candidate_name: "Charlie",
        votes: 60,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        round: 2,
        candidate_name: "David",
        votes: 0,
        status: "eliminated",
      }),

      // Round 3 - Alice elected
      createStvRoundsOutputFixture({
        round: 3,
        candidate_name: "Alice",
        votes: 134,
        status: "elected",
      }),
      createStvRoundsOutputFixture({
        round: 3,
        candidate_name: "Bob",
        votes: 150,
        status: "elected",
      }),
      createStvRoundsOutputFixture({
        round: 3,
        candidate_name: "Charlie",
        votes: 60,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        round: 3,
        candidate_name: "David",
        votes: 0,
        status: "eliminated",
      }),
    ];

    const multiRoundMetaData: StvMetaOutput[] = [
      createStvMetaOutputFixture({
        round: 1,
        quota: 134,
        exhausted: 0,
        elected_this_round: ["Bob"],
        eliminated_this_round: null,
      }),
      createStvMetaOutputFixture({
        round: 2,
        quota: 134,
        exhausted: 5,
        elected_this_round: null,
        eliminated_this_round: ["David"],
      }),
      createStvMetaOutputFixture({
        round: 3,
        quota: 134,
        exhausted: 5,
        elected_this_round: ["Alice"],
        eliminated_this_round: null,
      }),
    ];

    const multiRoundStats: StvRoundsStats = createStvRoundsStatsFixture({
      number_of_rounds: 3,
      winners: ["Bob", "Alice"],
      seats: 2,
      first_round_quota: 134,
    });

    const { container } = render(
      <StvRoundsView
        roundsData={multiRoundRoundsData}
        metaData={multiRoundMetaData}
        stats={multiRoundStats}
      />,
    );

    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).toContain("Charlie");
    expect(container.textContent).toContain("David");
  });

  it("handles large numbers of candidates", () => {
    const largeCandidateData: StvRoundsOutput[] = [];
    const candidateNames = Array.from(
      { length: 20 },
      (_, i) => `Candidate${i + 1}`,
    );

    candidateNames.forEach((name, index) => {
      largeCandidateData.push(
        createStvRoundsOutputFixture({
          candidate_name: name,
          votes: 100 - index * 5, // Decreasing vote counts
          status:
            index < 3 ? "elected" : index > 15 ? "eliminated" : "standing",
        }),
      );
    });

    const { container } = render(
      <StvRoundsView
        roundsData={largeCandidateData}
        metaData={sampleMetaData}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("Candidate1");
    expect(container.textContent).toContain("Candidate20");
  });

  it("handles exhausted votes display", () => {
    const metaWithExhausted: StvMetaOutput[] = [
      createStvMetaOutputFixture({
        quota: 134,
        exhausted: 25.5,
        elected_this_round: ["TestBob"],
        eliminated_this_round: null,
      }),
    ];

    const { container } = render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={metaWithExhausted}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("25.5"); // Should show exhausted votes
  });

  it("handles animation timing edge cases", () => {
    const multiRoundStats: StvRoundsStats = createStvRoundsStatsFixture({
      number_of_rounds: 10,
      winners: ["TestBob"],
      seats: 1,
      first_round_quota: 3,
    });

    render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={sampleMetaData}
        stats={multiRoundStats}
      />,
    );

    // Test rapid key presses
    const rapidEvents = [
      new KeyboardEvent("keydown", { key: "ArrowRight" }),
      new KeyboardEvent("keydown", { key: "ArrowRight" }),
      new KeyboardEvent("keydown", { key: "ArrowLeft" }),
      new KeyboardEvent("keydown", { key: " " }), // Start/stop autoplay
      new KeyboardEvent("keydown", { key: " " }), // Start/stop autoplay again quickly
    ];

    rapidEvents.forEach((event) => {
      window.dispatchEvent(event);
    });

    // Should handle rapid navigation without crashing
  });

  it("handles edge case with all candidates having same vote count", () => {
    const tiedRoundsData: StvRoundsOutput[] = [
      createStvRoundsOutputFixture({
        candidate_name: "TiedA",
        votes: 100,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        candidate_name: "TiedB",
        votes: 100,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        candidate_name: "TiedC",
        votes: 100,
        status: "standing",
      }),
    ];

    const { container } = render(
      <StvRoundsView
        roundsData={tiedRoundsData}
        metaData={sampleMetaData}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("TiedA");
    expect(container.textContent).toContain("TiedB");
    expect(container.textContent).toContain("TiedC");
  });

  it("handles data with fractional vote counts", () => {
    const fractionalRoundsData: StvRoundsOutput[] = [
      createStvRoundsOutputFixture({
        candidate_name: "FractionalA",
        votes: 123.456789,
        status: "standing",
      }),
      createStvRoundsOutputFixture({
        candidate_name: "FractionalB",
        votes: 67.123456,
        status: "elected",
      }),
    ];

    const { container } = render(
      <StvRoundsView
        roundsData={fractionalRoundsData}
        metaData={sampleMetaData}
        stats={sampleStats}
      />,
    );

    expect(container.textContent).toContain("FractionalA");
    expect(container.textContent).toContain("FractionalB");
    // Should handle fractional display properly
  });

  it("handles component unmounting during autoplay", () => {
    const multiRoundStats: StvRoundsStats = createStvRoundsStatsFixture({
      number_of_rounds: 5,
      winners: ["TestBob"],
      seats: 1,
      first_round_quota: 3,
    });

    const { unmount } = render(
      <StvRoundsView
        roundsData={sampleRoundsData}
        metaData={sampleMetaData}
        stats={multiRoundStats}
      />,
    );

    // Start autoplay
    const spaceEvent = new KeyboardEvent("keydown", { key: " " });
    window.dispatchEvent(spaceEvent);

    // Unmount component while autoplay might be running
    unmount();

    // Should not cause any errors or memory leaks
  });
});
