import { describe, expect, it } from "vitest";
import type { Manifest } from "@/contracts/manifest";
import {
  ContestResolver,
  createContestResolverSync,
} from "../contest-resolver";

describe("ContestResolver", () => {
  const testManifest: Manifest = {
    env: "test",
    version: 2,
    generated_at: "2024-01-01T00:00:00.000Z",
    inputs: {},
    elections: [
      {
        election_id: "test-election",
        date: "2024-01-01",
        jurisdiction: "test",
        title: "Test Election",
        contests: [
          {
            contest_id: "test-contest",
            district_id: "test-district",
            seat_count: 1,
            title: "Test Contest",
            cvr: {
              candidates: {
                uri: "test-candidates.parquet",
                sha256: "abc123",
                rows: 5,
              },
              ballots_long: {
                uri: "test-ballots.parquet",
                sha256: "def456",
                rows: 100,
              },
            },
            stv: {
              rounds: {
                uri: "test-stv-rounds.parquet",
                sha256: "ghi789",
                rows: 10,
              },
              meta: {
                uri: "test-stv-meta.parquet",
                sha256: "jkl012",
                rows: 3,
              },
            },
            first_choice: {
              uri: "test-first-choice.parquet",
              sha256: "mno345",
              rows: 5,
            },
            rules: {
              method: "meek",
              quota: "droop",
              precision: 0.000001,
              tie_break: "lexicographic",
              seats: 1,
            },
          },
        ],
      },
    ],
  };

  const resolver = new ContestResolver(testManifest);

  describe("getElection", () => {
    it("should return election when it exists", () => {
      const election = resolver.getElection("test-election");
      expect(election).toBeDefined();
      expect(election.election_id).toBe("test-election");
      expect(election.title).toBe("Test Election");
    });

    it("should throw error when election does not exist", () => {
      expect(() => resolver.getElection("nonexistent")).toThrow(
        "Election nonexistent not found",
      );
    });
  });

  describe("getContest", () => {
    it("should return contest when it exists", () => {
      const contest = resolver.getContest("test-election", "test-contest");
      expect(contest).toBeDefined();
      expect(contest.contest_id).toBe("test-contest");
      expect(contest.title).toBe("Test Contest");
      expect(contest.seat_count).toBe(1);
    });

    it("should throw error when contest does not exist", () => {
      expect(() => resolver.getContest("test-election", "nonexistent")).toThrow(
        "Contest test-election/nonexistent not found",
      );
    });

    it("should throw error when election does not exist", () => {
      expect(() => resolver.getContest("nonexistent", "test-contest")).toThrow(
        "Contest nonexistent/test-contest not found",
      );
    });
  });

  describe("getContestsForElection", () => {
    it("should return all contests for election", () => {
      const contests = resolver.getContestsForElection("test-election");
      expect(contests).toHaveLength(1);
      expect(contests[0].contest_id).toBe("test-contest");
    });

    it("should throw error when election does not exist", () => {
      expect(() => resolver.getContestsForElection("nonexistent")).toThrow(
        "Election nonexistent not found",
      );
    });
  });

  describe("hasFirstChoiceData", () => {
    it("should return true when contest has first choice data", () => {
      const hasData = resolver.hasFirstChoiceData(
        "test-election",
        "test-contest",
      );
      expect(hasData).toBe(true);
    });

    it("should throw error for nonexistent contest", () => {
      expect(() =>
        resolver.hasFirstChoiceData("test-election", "nonexistent"),
      ).toThrow("Contest test-election/nonexistent not found");
    });
  });

  describe("hasStvData", () => {
    it("should return true when contest has STV data", () => {
      const hasData = resolver.hasStvData("test-election", "test-contest");
      expect(hasData).toBe(true);
    });

    it("should throw error for nonexistent contest", () => {
      expect(() => resolver.hasStvData("test-election", "nonexistent")).toThrow(
        "Contest test-election/nonexistent not found",
      );
    });
  });

  describe("getFirstChoiceUri", () => {
    it("should return URI when contest has first choice data", () => {
      const uri = resolver.getFirstChoiceUri("test-election", "test-contest");
      expect(uri).toBe("test-first-choice.parquet");
    });

    it("should throw error for nonexistent contest", () => {
      expect(() =>
        resolver.getFirstChoiceUri("test-election", "nonexistent"),
      ).toThrow("Contest test-election/nonexistent not found");
    });
  });

  describe("getStvRoundsUri", () => {
    it("should return URI when contest has STV rounds data", () => {
      const uri = resolver.getStvRoundsUri("test-election", "test-contest");
      expect(uri).toBe("test-stv-rounds.parquet");
    });

    it("should throw error for nonexistent contest", () => {
      expect(() =>
        resolver.getStvRoundsUri("test-election", "nonexistent"),
      ).toThrow("Contest test-election/nonexistent not found");
    });
  });

  describe("getStvMetaUri", () => {
    it("should return URI when contest has STV meta data", () => {
      const uri = resolver.getStvMetaUri("test-election", "test-contest");
      expect(uri).toBe("test-stv-meta.parquet");
    });

    it("should throw error for nonexistent contest", () => {
      expect(() =>
        resolver.getStvMetaUri("test-election", "nonexistent"),
      ).toThrow("Contest test-election/nonexistent not found");
    });
  });
});

describe("createContestResolverSync", () => {
  it("should create resolver using dev manifest by default", () => {
    // This is more of an integration test that requires actual manifest file
    // For now, just verify it exists as a function
    expect(createContestResolverSync).toBeDefined();
    expect(typeof createContestResolverSync).toBe("function");
  });
});
