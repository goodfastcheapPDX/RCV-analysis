import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  candidateHasRankers,
  getMaxRank,
  RankDistributionError,
  selectCandidateRankDistribution,
} from "@/lib/slices/rankDistribution";
import { createOutputFixture } from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";

describe("rankDistribution utils", () => {
  describe("selectCandidateRankDistribution", () => {
    it("should return empty array for unknown candidate", () => {
      const mockData = [
        createOutputFixture({ candidate_id: 1, rank_position: 1, count: 10 }),
        createOutputFixture({ candidate_id: 2, rank_position: 1, count: 5 }),
      ];

      const result = selectCandidateRankDistribution(mockData, 999);

      expect(result).toEqual([]);
    });

    it("should filter and sort data for specific candidate", () => {
      const mockData = [
        createOutputFixture({
          candidate_id: 1,
          rank_position: 3,
          count: 30,
          pct_all_ballots: 0.15,
          pct_among_rankers: 0.3,
        }),
        createOutputFixture({
          candidate_id: 2,
          rank_position: 1,
          count: 50,
        }),
        createOutputFixture({
          candidate_id: 1,
          rank_position: 1,
          count: 100,
          pct_all_ballots: 0.5,
          pct_among_rankers: 1.0,
        }),
      ];

      const result = selectCandidateRankDistribution(mockData, 1);

      expect(result).toHaveLength(3); // ranks 1, 2, 3
      expect(result[0]).toEqual({
        rank: 1,
        count: 100,
        pct_all_ballots: 0.5,
        pct_among_rankers: 1.0,
      });
      expect(result[1]).toEqual({
        rank: 2,
        count: 0, // Filled with zeros
        pct_all_ballots: 0,
        pct_among_rankers: 0,
      });
      expect(result[2]).toEqual({
        rank: 3,
        count: 30,
        pct_all_ballots: 0.15,
        pct_among_rankers: 0.3,
      });
    });

    it("should fill gaps in rank positions with zeros", () => {
      const mockData = [
        createOutputFixture({
          candidate_id: 1,
          rank_position: 1,
          count: 50,
        }),
        createOutputFixture({
          candidate_id: 1,
          rank_position: 5,
          count: 10,
        }),
        // Missing ranks 2, 3, 4 should be filled with zeros
      ];

      const result = selectCandidateRankDistribution(mockData, 1);

      expect(result).toHaveLength(5);
      expect(result[0].rank).toBe(1);
      expect(result[0].count).toBe(50);
      expect(result[1].rank).toBe(2);
      expect(result[1].count).toBe(0);
      expect(result[2].rank).toBe(3);
      expect(result[2].count).toBe(0);
      expect(result[3].rank).toBe(4);
      expect(result[3].count).toBe(0);
      expect(result[4].rank).toBe(5);
      expect(result[4].count).toBe(10);
    });

    it("should sort results by rank position ascending", () => {
      const mockData = [
        createOutputFixture({ candidate_id: 1, rank_position: 3, count: 30 }),
        createOutputFixture({ candidate_id: 1, rank_position: 1, count: 100 }),
        createOutputFixture({ candidate_id: 1, rank_position: 2, count: 50 }),
      ];

      const result = selectCandidateRankDistribution(mockData, 1);

      expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    });
  });

  describe("candidateHasRankers", () => {
    it("should return true for candidate with ranking data", () => {
      const distribution = [
        { rank: 1, count: 100, pct_all_ballots: 0.5, pct_among_rankers: 1.0 },
        { rank: 2, count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
      ];

      expect(candidateHasRankers(distribution)).toBe(true);
    });

    it("should return false for zero-rank candidate", () => {
      const distribution = [
        { rank: 1, count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
        { rank: 2, count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
        { rank: 3, count: 0, pct_all_ballots: 0, pct_among_rankers: 0 },
      ];

      expect(candidateHasRankers(distribution)).toBe(false);
    });

    it("should return false for empty distribution", () => {
      expect(candidateHasRankers([])).toBe(false);
    });
  });

  describe("getMaxRank", () => {
    it("should return maximum rank position from data", () => {
      const mockData = [
        createOutputFixture({ rank_position: 1 }),
        createOutputFixture({ rank_position: 5 }),
        createOutputFixture({ rank_position: 3 }),
      ];

      expect(getMaxRank(mockData)).toBe(5);
    });

    it("should return 0 for empty data", () => {
      expect(getMaxRank([])).toBe(0);
    });
  });

  describe("RankDistributionError schema", () => {
    it("should validate MISSING_ARTIFACT error", () => {
      const error = {
        code: "MISSING_ARTIFACT" as const,
        message: "Not found",
        electionId: "test-election",
        contestId: "test-contest",
      };

      expect(() => RankDistributionError.parse(error)).not.toThrow();
    });

    it("should validate INVALID_DATA error", () => {
      const error = {
        code: "INVALID_DATA" as const,
        message: "Schema validation failed",
        cause: new z.ZodError([]),
      };

      expect(() => RankDistributionError.parse(error)).not.toThrow();
    });

    it("should validate DATABASE_ERROR", () => {
      const error = {
        code: "DATABASE_ERROR" as const,
        message: "Connection failed",
        cause: new Error("Network error"),
      };

      expect(() => RankDistributionError.parse(error)).not.toThrow();
    });

    it("should reject invalid error codes", () => {
      const error = {
        code: "INVALID_CODE",
        message: "Test",
      };

      expect(() => RankDistributionError.parse(error)).toThrow();
    });
  });
});
