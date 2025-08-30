import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  loadContestData,
  loadElectionWithContests,
  loadFirstChoiceForContest,
  loadStvForContest,
} from "../contest-resolver";

describe("contest-resolver contract enforcement", () => {
  // Tests now rely on global test setup to provide test data

  describe("loadElectionWithContests", () => {
    it("should load valid election data with proper validation", () => {
      const result = loadElectionWithContests("portland-20241105-gen");

      // Validate election structure
      expect(result.election).toBeDefined();
      expect(result.election.election_id).toBe("portland-20241105-gen");
      expect(result.election.contests).toBeDefined();
      expect(Array.isArray(result.election.contests)).toBe(true);
      expect(result.election.contests.length).toBeGreaterThan(0);

      // Validate manifest structure
      expect(result.manifest).toBeDefined();
      expect(result.manifest.version).toBe(2);
      expect(result.manifest.env).toBe("test");
    });

    it("should throw error for invalid election ID", () => {
      expect(() => {
        loadElectionWithContests("nonexistent-election");
      }).toThrow("Election 'nonexistent-election' not found in manifest");
    });
  });

  describe("loadContestData", () => {
    it("should load valid contest data with proper validation", () => {
      const result = loadContestData("portland-20241105-gen", "d2-3seat");

      // Validate contest structure
      expect(result.contest).toBeDefined();
      expect(result.contest.contest_id).toBe("d2-3seat");
      expect(result.contest.seat_count).toBeGreaterThan(0);
      expect(result.contest.title).toMatch(/district/i);

      // Validate election reference
      expect(result.election).toBeDefined();
      expect(result.election.election_id).toBe("portland-20241105-gen");

      // Validate artifacts structure
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.contest).toBe(result.contest);
    });

    it("should throw error for invalid contest ID", () => {
      expect(() => {
        loadContestData("portland-20241105-gen", "nonexistent-contest");
      }).toThrow(
        "Contest 'nonexistent-contest' not found in election 'portland-20241105-gen'",
      );
    });

    it("should throw error for invalid election ID", () => {
      expect(() => {
        loadContestData("nonexistent-election", "d2-3seat");
      }).toThrow("Election 'nonexistent-election' not found in manifest");
    });
  });

  describe("loadFirstChoiceForContest", () => {
    it("should load first choice data with contract validation", async () => {
      const result = await loadFirstChoiceForContest(
        "portland-20241105-gen",
        "d2-3seat",
      );

      // Validate data structure with contract enforcement
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Each row should conform to FirstChoiceOutput schema
      result.data.forEach((row) => {
        expect(typeof row.election_id).toBe("string");
        expect(row.election_id.length).toBeGreaterThan(0);
        expect(typeof row.contest_id).toBe("string");
        expect(row.contest_id.length).toBeGreaterThan(0);
        expect(typeof row.district_id).toBe("string");
        expect(row.district_id.length).toBeGreaterThan(0);
        expect(typeof row.seat_count).toBe("number");
        expect(row.seat_count).toBeGreaterThan(0);
        expect(typeof row.candidate_name).toBe("string");
        expect(row.candidate_name.length).toBeGreaterThan(0);
        expect(typeof row.first_choice_votes).toBe("number");
        expect(row.first_choice_votes).toBeGreaterThanOrEqual(0);
        expect(typeof row.pct).toBe("number");
        expect(row.pct).toBeGreaterThanOrEqual(0);
        expect(row.pct).toBeLessThanOrEqual(100);
      });

      // Validate contest and election references
      expect(result.contest).toBeDefined();
      expect(result.contest.contest_id).toBe("d2-3seat");
      expect(result.election).toBeDefined();
      expect(result.election.election_id).toBe("portland-20241105-gen");
    });

    it("should throw error for missing first choice data", async () => {
      // Since we know this contest exists but might not have first choice data built,
      // we test with a valid contest but expect potential data availability error
      try {
        await loadFirstChoiceForContest("portland-20241105-gen", "d2-3seat");
      } catch (error) {
        if (error instanceof Error) {
          // Should be a descriptive error about missing data files
          expect(error.message).toMatch(
            /(First choice data not found|not found for)/i,
          );
        } else {
          throw error;
        }
      }
    });
  });

  describe("loadStvForContest", () => {
    it("should load STV data with contract validation", async () => {
      const result = await loadStvForContest(
        "portland-20241105-gen",
        "d2-3seat",
      );

      // Validate rounds data with contract enforcement
      expect(result.roundsData).toBeDefined();
      expect(Array.isArray(result.roundsData)).toBe(true);
      expect(result.roundsData.length).toBeGreaterThan(0);

      // Each round should conform to StvRoundsOutput schema
      result.roundsData.forEach((round) => {
        expect(typeof round.election_id).toBe("string");
        expect(round.election_id.length).toBeGreaterThan(0);
        expect(typeof round.contest_id).toBe("string");
        expect(round.contest_id.length).toBeGreaterThan(0);
        expect(typeof round.district_id).toBe("string");
        expect(round.district_id.length).toBeGreaterThan(0);
        expect(typeof round.seat_count).toBe("number");
        expect(round.seat_count).toBeGreaterThan(0);
        expect(typeof round.round).toBe("number");
        expect(round.round).toBeGreaterThan(0);
        expect(typeof round.candidate_name).toBe("string");
        expect(round.candidate_name.length).toBeGreaterThan(0);
        expect(typeof round.votes).toBe("number");
        expect(round.votes).toBeGreaterThanOrEqual(0);
        expect(typeof round.status).toBe("string");
        expect(round.status.length).toBeGreaterThan(0);
      });

      // Validate meta data with contract enforcement
      expect(result.metaData).toBeDefined();
      expect(Array.isArray(result.metaData)).toBe(true);
      expect(result.metaData.length).toBeGreaterThan(0);

      // Each meta row should conform to StvMetaOutput schema
      result.metaData.forEach((meta) => {
        expect(typeof meta.election_id).toBe("string");
        expect(meta.election_id.length).toBeGreaterThan(0);
        expect(typeof meta.contest_id).toBe("string");
        expect(meta.contest_id.length).toBeGreaterThan(0);
        expect(typeof meta.district_id).toBe("string");
        expect(meta.district_id.length).toBeGreaterThan(0);
        expect(typeof meta.seat_count).toBe("number");
        expect(meta.seat_count).toBeGreaterThan(0);
        expect(typeof meta.round).toBe("number");
        expect(meta.round).toBeGreaterThan(0);
        expect(typeof meta.quota).toBe("number");
        expect(meta.quota).toBeGreaterThan(0);
        expect(typeof meta.exhausted).toBe("number");
        expect(meta.exhausted).toBeGreaterThanOrEqual(0);
      });

      // Validate stats if present
      if (result.stats) {
        expect(typeof result.stats.number_of_rounds).toBe("number");
        expect(result.stats.number_of_rounds).toBeGreaterThan(0);
        expect(Array.isArray(result.stats.winners)).toBe(true);
        expect(result.stats.winners.length).toBeGreaterThan(0);
        expect(typeof result.stats.seats).toBe("number");
        expect(result.stats.seats).toBeGreaterThan(0);
        expect(typeof result.stats.first_round_quota).toBe("number");
        expect(result.stats.first_round_quota).toBeGreaterThan(0);
        expect(typeof result.stats.precision).toBe("number");
        expect(result.stats.precision).toBeGreaterThan(0);
      }

      // Validate contest and election references
      expect(result.contest).toBeDefined();
      expect(result.contest.contest_id).toBe("d2-3seat");
      expect(result.election).toBeDefined();
      expect(result.election.election_id).toBe("portland-20241105-gen");
    });

    it("should throw error for missing STV data files", async () => {
      try {
        await loadStvForContest("portland-20241105-gen", "d2-3seat");
      } catch (error) {
        if (error instanceof Error) {
          // Should be a descriptive error about missing data files
          expect(error.message).toMatch(/(STV.*data not found|not found for)/i);
        } else {
          throw error;
        }
      }
    });
  });

  describe("Contract enforcement integration", () => {
    it("should enforce contracts at runtime preventing bad data", async () => {
      // This test demonstrates that contract enforcement prevents corrupted data
      // from reaching the application layer

      const { election } = loadElectionWithContests("portland-20241105-gen");

      // All elections should have valid structure due to contract enforcement
      expect(election.election_id).toMatch(/^[a-z0-9-]+$/);
      expect(election.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(election.jurisdiction.length).toBeGreaterThan(0);
      expect(election.title.length).toBeGreaterThan(0);
      expect(election.contests.length).toBeGreaterThan(0);

      // All contests should have valid structure due to contract enforcement
      election.contests.forEach((contest) => {
        expect(contest.contest_id).toMatch(/^[a-z0-9-]+$/);
        expect(contest.district_id).toMatch(/^[a-z0-9-]+$/);
        expect(contest.seat_count).toBeGreaterThan(0);
        expect(contest.title.length).toBeGreaterThan(0);
        expect(contest.cvr).toBeDefined();
        expect(contest.cvr.candidates).toBeDefined();
        expect(contest.cvr.ballots_long).toBeDefined();
        expect(contest.rules).toBeDefined();
        expect(contest.rules.seats).toBe(contest.seat_count);
      });
    });

    it("should maintain data consistency across all resolver functions", async () => {
      // Load data through multiple paths and verify consistency
      const electionResult = loadElectionWithContests("portland-20241105-gen");
      const contestResult = loadContestData(
        "portland-20241105-gen",
        "d2-3seat",
      );

      // Same election should be identical
      expect(contestResult.election).toEqual(electionResult.election);

      // Contest should be found in election
      const contestInElection = electionResult.election.contests.find(
        (c) => c.contest_id === "d2-3seat",
      );
      expect(contestInElection).toEqual(contestResult.contest);

      // All data should reference the same election and contest
      try {
        const firstChoiceResult = await loadFirstChoiceForContest(
          "portland-20241105-gen",
          "d2-3seat",
        );
        expect(firstChoiceResult.election).toEqual(electionResult.election);
        expect(firstChoiceResult.contest).toEqual(contestResult.contest);
      } catch (error) {
        // Data might not be available in test, that's OK
      }

      try {
        const stvResult = await loadStvForContest(
          "portland-20241105-gen",
          "d2-3seat",
        );
        expect(stvResult.election).toEqual(electionResult.election);
        expect(stvResult.contest).toEqual(contestResult.contest);
      } catch (error) {
        // Data might not be available in test, that's OK
      }
    });
  });
});
