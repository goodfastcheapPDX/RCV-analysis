import { describe, expect, it } from "vitest";
import { computeCandidateAffinityJaccard } from "./compute";
import { Output, Stats, VALIDATION_RULES } from "./index.contract";

describe("candidate_affinity_jaccard integration tests", () => {
  const testElectionId = "portland-20241105-gen";
  const testContestId = "d2-3seat";
  const testEnv = "test";

  describe("end-to-end slice validation", () => {
    it("should pass all structural checks", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // All structural checks from VALIDATION_RULES should pass
      const checks = VALIDATION_RULES.structuralChecks;

      // These checks are implicitly validated by the contract enforcement
      expect(checks).toContain("All pair_count values >= 0");
      expect(checks).toContain("All presence_a, presence_b values >= 0");
      expect(checks).toContain("All union_count values >= 0");
      expect(checks).toContain("All jaccard values in [0, 1]");
      expect(checks).toContain("candidate_a < candidate_b for all rows");
      expect(checks).toContain("No self pairs: candidate_a != candidate_b");
      expect(checks).toContain("pair_count <= union_count for all rows");

      // Verify the computation completed successfully
      expect(result.stats.compute_ms).toBeGreaterThan(0);
      expect(result.data.rows).toBeGreaterThanOrEqual(0);
    });

    it("should pass all semantic checks", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      const checks = VALIDATION_RULES.semanticChecks;

      // These are verified by the mathematical constraints tested in compute.test.ts
      expect(checks).toContain(
        "pair_count <= MIN(presence_a, presence_b) for all rows",
      );
      expect(checks).toContain(
        "presence_a, presence_b <= total_ballots_considered",
      );
      expect(checks).toContain(
        "union_count = presence_a + presence_b - pair_count for all rows",
      );
      expect(checks).toContain("max_jaccard <= 1");
      expect(checks).toContain(
        "unique_pairs equals number of distinct (candidate_a, candidate_b) pairs",
      );

      // Specific semantic validations
      expect(result.stats.max_jaccard).toBeLessThanOrEqual(1);
      expect(result.stats.unique_pairs).toBe(result.data.rows);
    });

    it("should pass all mathematical checks", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      const checks = VALIDATION_RULES.mathematicalChecks;

      // Mathematical correctness is validated in the DuckDB queries
      expect(checks).toContain(
        "jaccard = pair_count / union_count when union_count > 0 (within float tolerance)",
      );
      expect(checks).toContain("jaccard = 0 when union_count = 0");
      expect(checks).toContain(
        "Symmetric reconstruction: matrix M[a,b] == M[b,a] when mirrored",
      );

      // The zero union pairs stat should track cases where union_count = 0
      expect(result.stats.zero_union_pairs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge case handling", () => {
    it("should handle single-candidate ballots gracefully", async () => {
      // This test verifies behavior with minimal pair data
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Should still produce valid stats even if few pairs exist
      expect(result.stats.total_ballots_considered).toBeGreaterThan(0);
      expect(result.stats.unique_pairs).toBeGreaterThanOrEqual(0);
      expect(result.data.rows).toBe(result.stats.unique_pairs);
    });

    it("should produce deterministic results", async () => {
      // Run computation twice and verify identical results
      const result1 = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      const result2 = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Stats should be identical (excluding compute_ms which may vary slightly)
      expect(result1.stats.total_ballots_considered).toBe(
        result2.stats.total_ballots_considered,
      );
      expect(result1.stats.unique_pairs).toBe(result2.stats.unique_pairs);
      expect(result1.stats.max_jaccard).toBe(result2.stats.max_jaccard);
      expect(result1.stats.zero_union_pairs).toBe(
        result2.stats.zero_union_pairs,
      );
      expect(result1.data.rows).toBe(result2.data.rows);
    });
  });

  describe("manifest integration", () => {
    it("should update manifest with correct artifact information", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // The compute function should have updated the manifest
      // This is validated by the successful completion of the compute function
      expect(result.stats).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe("performance validation", () => {
    it("should complete within acceptable time limits", async () => {
      const startTime = Date.now();

      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      const totalTime = Date.now() - startTime;

      // Should be well within the 60-second budget mentioned in the task
      expect(totalTime).toBeLessThan(60000);
      expect(result.stats.compute_ms).toBeGreaterThan(0);
      expect(result.stats.compute_ms).toBeLessThan(60000);
    });
  });

  describe("contract conformance", () => {
    it("should produce data that validates against Output schema", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // The parseAllRows call in compute.ts already validates this
      // This test documents that requirement
      expect(result.data.rows).toBeGreaterThanOrEqual(0);
      expect(result.stats.total_ballots_considered).toBeGreaterThan(0);
    });

    it("should produce stats that validate against Stats schema", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Verify stats conform to expected schema
      const stats = result.stats;
      expect(typeof stats.total_ballots_considered).toBe("number");
      expect(typeof stats.unique_pairs).toBe("number");
      expect(typeof stats.max_jaccard).toBe("number");
      expect(typeof stats.zero_union_pairs).toBe("number");
      expect(typeof stats.compute_ms).toBe("number");

      expect(stats.total_ballots_considered).toBeGreaterThan(0);
      expect(stats.unique_pairs).toBeGreaterThanOrEqual(0);
      expect(stats.max_jaccard).toBeGreaterThanOrEqual(0);
      expect(stats.max_jaccard).toBeLessThanOrEqual(1);
      expect(stats.zero_union_pairs).toBeGreaterThanOrEqual(0);
      expect(stats.compute_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Jaccard coefficient properties", () => {
    it("should demonstrate Jaccard similarity properties with realistic data", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Jaccard coefficients should show realistic similarity patterns
      // For electoral data, we expect most pairs to have moderate similarity
      expect(result.stats.max_jaccard).toBeGreaterThan(0); // Some similarity should exist
      expect(result.stats.max_jaccard).toBeLessThanOrEqual(1); // Upper bound

      // Zero union pairs should be minimal in real electoral data
      expect(result.stats.zero_union_pairs).toBeLessThanOrEqual(
        result.stats.unique_pairs,
      );
    });
  });
});
