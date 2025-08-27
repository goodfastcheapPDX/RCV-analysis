import { describe, expect, it } from "vitest";
import type { BallotData } from "./engine.js";
import { runSTV } from "./engine.js";
import { RulesSchema } from "./index.contract.js";

describe("STV Engine Functional Tests", () => {
  const defaultRules = RulesSchema.parse({
    seats: 2,
    quota: "droop",
    surplus_method: "fractional",
    precision: 1e-6,
    tie_break: "lexicographic",
  });

  describe("Basic STV Mechanics", () => {
    it("should handle simple two-seat election with clear winners", () => {
      const ballots: BallotData[] = [
        // 3 ballots for Alice (rank 1), Bob (rank 2)
        { BallotID: "B1", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B1", candidate_name: "Bob", rank_position: 2 },
        { BallotID: "B2", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B2", candidate_name: "Bob", rank_position: 2 },
        { BallotID: "B3", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B3", candidate_name: "Bob", rank_position: 2 },

        // 2 ballots for Bob (rank 1), Alice (rank 2)
        { BallotID: "B4", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B4", candidate_name: "Alice", rank_position: 2 },
        { BallotID: "B5", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B5", candidate_name: "Alice", rank_position: 2 },

        // 1 ballot for Charlie (rank 1), Alice (rank 2)
        { BallotID: "B6", candidate_name: "Charlie", rank_position: 1 },
        { BallotID: "B6", candidate_name: "Alice", rank_position: 2 },
      ];

      const result = runSTV(ballots, defaultRules);

      expect(result.winners).toHaveLength(2);
      expect(result.winners).toContain("Alice");
      expect(result.winners).toContain("Bob");
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.meta.length).toBeGreaterThan(0);

      // Check that winners have 'elected' status in final round
      const finalRound = Math.max(...result.rounds.map((r) => r.round));
      const finalRoundData = result.rounds.filter(
        (r) => r.round === finalRound,
      );

      for (const winner of result.winners) {
        const winnerRecord = finalRoundData.find(
          (r) => r.candidate_name === winner,
        );
        expect(winnerRecord?.status).toBe("elected");
      }
    });

    it("should calculate correct Droop quota", () => {
      const ballots: BallotData[] = [
        { BallotID: "B1", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B2", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B3", candidate_name: "Charlie", rank_position: 1 },
        { BallotID: "B4", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B5", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B6", candidate_name: "Charlie", rank_position: 1 },
        { BallotID: "B7", candidate_name: "Alice", rank_position: 1 },
      ];

      // 7 ballots, 2 seats -> Droop quota = floor(7/(2+1)) + 1 = floor(2.33) + 1 = 3
      const result = runSTV(ballots, defaultRules);

      expect(result.meta[0].quota).toBe(3);
    });

    it("should handle elimination correctly", () => {
      const ballots: BallotData[] = [
        // Alice: 3 first-choice votes
        { BallotID: "B1", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B2", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B3", candidate_name: "Alice", rank_position: 1 },

        // Bob: 2 first-choice votes, with Charlie as backup
        { BallotID: "B4", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B4", candidate_name: "Charlie", rank_position: 2 },
        { BallotID: "B5", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B5", candidate_name: "Charlie", rank_position: 2 },

        // Charlie: 1 first-choice vote
        { BallotID: "B6", candidate_name: "Charlie", rank_position: 1 },
      ];

      // 6 ballots, 2 seats -> Droop quota = floor(6/3) + 1 = 3
      const result = runSTV(ballots, defaultRules);

      // Alice should be elected immediately (3 votes >= 3 quota)
      expect(result.winners).toContain("Alice");

      // Charlie should be eliminated first (lowest votes), transferring to other candidates
      const eliminatedCandidates = result.rounds
        .filter((r) => r.status === "eliminated")
        .map((r) => r.candidate_name);

      expect(eliminatedCandidates).toContain("Charlie");
    });

    it("should handle surplus transfer with Gregory method", () => {
      const ballots: BallotData[] = [
        // Alice: 4 votes (exceeds quota of 3)
        { BallotID: "B1", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B1", candidate_name: "Bob", rank_position: 2 },
        { BallotID: "B2", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B2", candidate_name: "Bob", rank_position: 2 },
        { BallotID: "B3", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B3", candidate_name: "Charlie", rank_position: 2 },
        { BallotID: "B4", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B4", candidate_name: "Charlie", rank_position: 2 },

        // Bob: 1 vote
        { BallotID: "B5", candidate_name: "Bob", rank_position: 1 },

        // Charlie: 1 vote
        { BallotID: "B6", candidate_name: "Charlie", rank_position: 1 },
      ];

      // 6 ballots, 2 seats -> Droop quota = 3
      // Alice gets 4 votes, surplus = 1
      // Transfer weight = 1/4 = 0.25 per ballot
      const result = runSTV(ballots, defaultRules);

      expect(result.winners).toContain("Alice");
      expect(result.rounds.length).toBeGreaterThan(2); // Should have multiple rounds due to surplus transfer

      // After surplus transfer, Bob and Charlie should have received fractional votes
      const round1Records = result.rounds.filter((r) => r.round === 1);
      const bobRound1 = round1Records.find((r) => r.candidate_name === "Bob");
      const charlieRound1 = round1Records.find(
        (r) => r.candidate_name === "Charlie",
      );

      // Both should have more than their initial 1 vote due to surplus transfer
      expect(bobRound1?.votes).toBeGreaterThan(1);
      expect(charlieRound1?.votes).toBeGreaterThan(1);
    });

    it("should handle exhausted ballots", () => {
      const ballots: BallotData[] = [
        // Ballots with only one preference that gets eliminated
        { BallotID: "B1", candidate_name: "Eliminated", rank_position: 1 },
        { BallotID: "B2", candidate_name: "Eliminated", rank_position: 1 },

        // Ballots with continuing preferences
        { BallotID: "B3", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B4", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B5", candidate_name: "Bob", rank_position: 1 },
        { BallotID: "B6", candidate_name: "Bob", rank_position: 1 },
      ];

      const result = runSTV(ballots, defaultRules);

      // Should have some exhausted votes after elimination
      const finalMeta = result.meta[result.meta.length - 1];
      expect(finalMeta.exhausted).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle tie-breaking lexicographically", () => {
      const ballots: BallotData[] = [
        { BallotID: "B1", candidate_name: "Zebra", rank_position: 1 }, // Same vote count
        { BallotID: "B2", candidate_name: "Alpha", rank_position: 1 }, // Same vote count
        { BallotID: "B3", candidate_name: "Winner", rank_position: 1 },
        { BallotID: "B4", candidate_name: "Winner", rank_position: 1 },
        { BallotID: "B5", candidate_name: "Winner", rank_position: 1 },
      ];

      // 5 ballots, 2 seats -> quota = 2
      // Winner gets 3 votes (elected), Alpha and Zebra tie with 1 vote each
      // Alpha should be eliminated first (lexicographically before Zebra)
      const result = runSTV(ballots, defaultRules);

      const eliminatedCandidates = result.rounds
        .filter((r) => r.status === "eliminated")
        .map((r) => r.candidate_name);

      expect(eliminatedCandidates).toContain("Alpha");
      expect(result.winners).toContain("Winner");
    });

    it("should handle single-candidate election", () => {
      const ballots: BallotData[] = [
        { BallotID: "B1", candidate_name: "OnlyCandidate", rank_position: 1 },
        { BallotID: "B2", candidate_name: "OnlyCandidate", rank_position: 1 },
      ];

      const singleSeatRules = RulesSchema.parse({
        ...defaultRules,
        seats: 1,
      });

      const result = runSTV(ballots, singleSeatRules);

      expect(result.winners).toEqual(["OnlyCandidate"]);
      expect(result.rounds.length).toBeGreaterThan(0);
    });

    it("should handle more seats than candidates", () => {
      const ballots: BallotData[] = [
        { BallotID: "B1", candidate_name: "Alice", rank_position: 1 },
        { BallotID: "B2", candidate_name: "Bob", rank_position: 1 },
      ];

      const manySeatsRules = RulesSchema.parse({
        ...defaultRules,
        seats: 3, // More seats than candidates
      });

      const result = runSTV(ballots, manySeatsRules);

      // Should elect all available candidates
      expect(result.winners).toContain("Alice");
      expect(result.winners).toContain("Bob");
      expect(result.winners.length).toBe(2); // Only 2 candidates available
    });
  });

  describe("Precision and Numerical Stability", () => {
    it("should handle small vote fractions correctly", () => {
      const ballots: BallotData[] = [];

      // Create a scenario that results in very small fractional transfers
      for (let i = 1; i <= 100; i++) {
        ballots.push({
          BallotID: `B${i}`,
          candidate_name: "MajorityWinner",
          rank_position: 1,
        });
        if (i <= 10) {
          ballots.push({
            BallotID: `B${i}`,
            candidate_name: "MinorCandidate",
            rank_position: 2,
          });
        }
      }

      for (let i = 101; i <= 105; i++) {
        ballots.push({
          BallotID: `B${i}`,
          candidate_name: "MinorCandidate",
          rank_position: 1,
        });
      }

      const result = runSTV(ballots, { ...defaultRules, seats: 1 });

      expect(result.winners).toContain("MajorityWinner");
      expect(result.rounds.every((r) => !isNaN(r.votes))).toBe(true);
      expect(
        result.meta.every((m) => !isNaN(m.quota) && !isNaN(m.exhausted)),
      ).toBe(true);
    });

    it("should maintain vote conservation throughout counting", () => {
      const ballots: BallotData[] = [
        { BallotID: "B1", candidate_name: "A", rank_position: 1 },
        { BallotID: "B1", candidate_name: "B", rank_position: 2 },
        { BallotID: "B2", candidate_name: "B", rank_position: 1 },
        { BallotID: "B2", candidate_name: "C", rank_position: 2 },
        { BallotID: "B3", candidate_name: "C", rank_position: 1 },
        { BallotID: "B3", candidate_name: "A", rank_position: 2 },
        { BallotID: "B4", candidate_name: "A", rank_position: 1 },
        { BallotID: "B5", candidate_name: "B", rank_position: 1 },
      ];

      const result = runSTV(ballots, defaultRules);
      const totalBallots = 5;

      // Check vote conservation in each round
      for (const meta of result.meta) {
        const roundRecords = result.rounds.filter(
          (r) => r.round === meta.round,
        );
        const totalVotes = roundRecords.reduce((sum, r) => sum + r.votes, 0);
        const totalWithExhausted = totalVotes + meta.exhausted;

        // Should equal total ballots (within precision tolerance)
        expect(Math.abs(totalWithExhausted - totalBallots)).toBeLessThan(1e-6);
      }
    });
  });
});
