import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { computeCandidateAffinityProximity } from "./compute";
import { createOutputFixture, Output } from "./index.contract";

describe("computeCandidateAffinityProximity", () => {
  // Use the global test data that's already set up by the test environment
  const testElectionId = "portland-20241105-gen";
  const testContestId = "d2-3seat";
  const testEnv = "test";

  describe("successful computation", () => {
    it("should compute candidate affinity proximity with correct data", async () => {
      const result = await computeCandidateAffinityProximity({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Validate return structure matches contract
      expect(result).toMatchObject({
        stats: {
          total_ballots_considered: expect.any(Number),
          unique_pairs: expect.any(Number),
          alpha: 0.5,
          max_weight_sum: expect.any(Number),
          compute_ms: expect.any(Number),
        },
        data: {
          rows: expect.any(Number),
        },
      });

      // Validate stats are reasonable
      expect(result.stats.total_ballots_considered).toBeGreaterThan(0);
      expect(result.stats.unique_pairs).toBeGreaterThanOrEqual(0);
      expect(result.stats.alpha).toBe(0.5);
      expect(result.stats.max_weight_sum).toBeGreaterThanOrEqual(0);
      expect(result.stats.compute_ms).toBeGreaterThan(0);
      expect(result.data.rows).toBe(result.stats.unique_pairs);
    });

    it("should create parquet file with correct structure", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_proximity/candidate_affinity_proximity.parquet`;

      // Ensure the file was created
      expect(existsSync(outputPath)).toBe(true);

      // Validate the parquet file structure using DuckDB
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT 
          COUNT(*) as row_count,
          COUNT(DISTINCT candidate_a) as unique_candidate_a,
          COUNT(DISTINCT candidate_b) as unique_candidate_b,
          MIN(weight_sum) as min_weight,
          MAX(weight_sum) as max_weight,
          MIN(pair_count) as min_pair_count,
          MAX(pair_count) as max_pair_count,
          MIN(avg_distance) as min_distance,
          MAX(avg_distance) as max_distance
        FROM '${outputPath}'
      `);

      const stats = await result.getRowObjects();
      const row = stats[0];

      expect(row.row_count).toBeGreaterThanOrEqual(0);
      expect(Number(row.min_weight)).toBeGreaterThanOrEqual(0);
      expect(Number(row.max_weight)).toBeGreaterThanOrEqual(
        Number(row.min_weight),
      );
      expect(Number(row.min_pair_count)).toBeGreaterThanOrEqual(0);
      expect(Number(row.max_pair_count)).toBeGreaterThanOrEqual(
        Number(row.min_pair_count),
      );
      expect(Number(row.min_distance)).toBeGreaterThanOrEqual(1);
      expect(Number(row.max_distance)).toBeLessThanOrEqual(5);

      await conn.closeSync();
    });

    it("should validate contract constraints on computed data", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_proximity/candidate_affinity_proximity.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      // Test canonical ordering constraint
      const orderingResult = await conn.run(`
        SELECT COUNT(*) as violations 
        FROM '${outputPath}' 
        WHERE candidate_a >= candidate_b
      `);
      const orderingRows = await orderingResult.getRowObjects();
      expect(Number(orderingRows[0].violations)).toBe(0);

      // Test weight_sum <= pair_count constraint (since α ≤ 1)
      const weightConstraintResult = await conn.run(`
        SELECT COUNT(*) as violations 
        FROM '${outputPath}' 
        WHERE weight_sum > pair_count
      `);
      const weightConstraintRows = await weightConstraintResult.getRowObjects();
      expect(Number(weightConstraintRows[0].violations)).toBe(0);

      // Test avg_distance bounds when pair_count > 0
      const distanceConstraintResult = await conn.run(`
        SELECT COUNT(*) as violations 
        FROM '${outputPath}' 
        WHERE pair_count > 0 AND (avg_distance < 1 OR avg_distance > 5)
      `);
      const distanceConstraintRows =
        await distanceConstraintResult.getRowObjects();
      expect(Number(distanceConstraintRows[0].violations)).toBe(0);

      // Test no self-pairs
      const selfPairResult = await conn.run(`
        SELECT COUNT(*) as violations 
        FROM '${outputPath}' 
        WHERE candidate_a = candidate_b
      `);
      const selfPairRows = await selfPairResult.getRowObjects();
      expect(Number(selfPairRows[0].violations)).toBe(0);

      await conn.closeSync();
    });
  });

  describe("mathematical correctness", () => {
    it("should correctly implement proximity weighting formula", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_proximity/candidate_affinity_proximity.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      // Validate that proximity weights are reasonable
      const proximityValidation = await conn.run(`
        WITH sample AS (
          SELECT * FROM '${outputPath}' 
          WHERE pair_count > 0
          LIMIT 5
        )
        SELECT 
          candidate_a,
          candidate_b,
          weight_sum,
          pair_count,
          avg_distance,
          -- Adjacent pairs should have higher weight/pair ratio
          weight_sum / pair_count as avg_weight_per_pair
        FROM sample
        ORDER BY avg_distance
      `);

      const rows = await proximityValidation.getRowObjects();

      // Should have some data to validate
      expect(rows.length).toBeGreaterThan(0);

      for (const row of rows) {
        // Average weight per pair should be <= 1 (since max weight is 1 for adjacent pairs)
        expect(row.avg_weight_per_pair).toBeLessThanOrEqual(1.0001); // Allow small float precision
        expect(row.avg_weight_per_pair).toBeGreaterThan(0);
      }

      await conn.closeSync();
    });

    it("should handle edge cases correctly", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_proximity/candidate_affinity_proximity.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      // Check for pairs with maximum distance (should have minimum weight)
      const maxDistanceResult = await conn.run(`
        SELECT 
          COUNT(*) as max_distance_pairs,
          MIN(weight_sum / pair_count) as min_avg_weight
        FROM '${outputPath}' 
        WHERE avg_distance >= 4.5  -- Close to max distance of 5
        AND pair_count > 0
      `);

      const maxDistanceRows = await maxDistanceResult.getRowObjects();
      if (Number(maxDistanceRows[0].max_distance_pairs) > 0) {
        // These should have very low average weight (α^4 = 0.5^4 = 0.0625)
        expect(Number(maxDistanceRows[0].min_avg_weight)).toBeLessThan(0.1);
      }

      // Check for pairs with minimum distance (should have maximum weight)
      const minDistanceResult = await conn.run(`
        SELECT 
          COUNT(*) as min_distance_pairs,
          MAX(weight_sum / pair_count) as max_avg_weight
        FROM '${outputPath}' 
        WHERE avg_distance <= 1.5  -- Close to min distance of 1
        AND pair_count > 0
      `);

      const minDistanceRows = await minDistanceResult.getRowObjects();
      if (Number(minDistanceRows[0].min_distance_pairs) > 0) {
        // These should have high average weight (close to 1.0 for adjacent ranks)
        expect(Number(minDistanceRows[0].max_avg_weight)).toBeGreaterThan(0.8);
      }

      await conn.closeSync();
    });
  });

  describe("data consistency with raw co-occurrence", () => {
    it("should have consistent ballot totals with raw affinity matrix", async () => {
      // This test verifies that proximity and raw co-occurrence use the same input data
      const result = await computeCandidateAffinityProximity({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Load raw affinity matrix for comparison
      const { computeCandidateAffinityMatrix } = await import(
        "../candidate_affinity_matrix/compute"
      );
      const rawResult = await computeCandidateAffinityMatrix({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Both should consider the same number of ballots
      expect(result.stats.total_ballots_considered).toBe(
        rawResult.stats.total_ballots_considered,
      );

      // Proximity should have same or fewer pairs (due to filtering tied ranks)
      expect(result.stats.unique_pairs).toBeLessThanOrEqual(
        rawResult.stats.unique_pairs,
      );
    });
  });
});

describe("Output contract validation", () => {
  it("should validate output fixture against schema", () => {
    const fixture = createOutputFixture();
    const parsed = Output.parse(fixture);

    expect(parsed).toMatchObject(fixture);
    expect(parsed.candidate_a).toBeLessThan(parsed.candidate_b);
    expect(parsed.weight_sum).toBeLessThanOrEqual(parsed.pair_count);
    expect(parsed.avg_distance).toBeGreaterThanOrEqual(1);
    expect(parsed.avg_distance).toBeLessThanOrEqual(5);
  });

  it("should reject invalid output data", () => {
    // Test self-pair rejection
    expect(() =>
      Output.parse(
        createOutputFixture({
          candidate_a: 1,
          candidate_b: 1,
        }),
      ),
    ).toThrow("Self pairs are not allowed");

    // Test canonical ordering
    expect(() =>
      Output.parse(
        createOutputFixture({
          candidate_a: 2,
          candidate_b: 1,
        }),
      ),
    ).toThrow("Canonical ordering required");

    // Test weight_sum <= pair_count constraint
    expect(() =>
      Output.parse(
        createOutputFixture({
          weight_sum: 200,
          pair_count: 150,
        }),
      ),
    ).toThrow("weight_sum must not exceed pair_count");

    // Test avg_distance bounds
    expect(() =>
      Output.parse(
        createOutputFixture({
          avg_distance: 0.5,
          pair_count: 10,
        }),
      ),
    ).toThrow("avg_distance must be >= 1");

    expect(() =>
      Output.parse(
        createOutputFixture({
          weight_sum: 15,
          pair_count: 10, // weight_sum > pair_count should fail
        }),
      ),
    ).toThrow("weight_sum must not exceed pair_count");
  });
});
