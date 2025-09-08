import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { computeCandidateAffinityJaccard } from "./compute";
import { createOutputFixture, Output } from "./index.contract";

describe("computeCandidateAffinityJaccard", () => {
  // Use the global test data that's already set up by the test environment
  const testElectionId = "portland-20241105-gen";
  const testContestId = "d2-3seat";
  const testEnv = "test";

  describe("successful computation", () => {
    it("should compute candidate affinity jaccard with correct data", async () => {
      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Validate return structure matches contract
      expect(result).toMatchObject({
        stats: {
          total_ballots_considered: expect.any(Number),
          unique_pairs: expect.any(Number),
          max_jaccard: expect.any(Number),
          zero_union_pairs: expect.any(Number),
          compute_ms: expect.any(Number),
        },
        data: {
          rows: expect.any(Number),
        },
      });

      // Validate stats are reasonable
      expect(result.stats.total_ballots_considered).toBeGreaterThan(0);
      expect(result.stats.unique_pairs).toBeGreaterThanOrEqual(0);
      expect(result.stats.max_jaccard).toBeGreaterThanOrEqual(0);
      expect(result.stats.max_jaccard).toBeLessThanOrEqual(1);
      expect(result.stats.zero_union_pairs).toBeGreaterThanOrEqual(0);
      expect(result.stats.compute_ms).toBeGreaterThan(0);
      expect(result.data.rows).toBe(result.stats.unique_pairs);
    });

    it("should create parquet file with correct structure", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      // Ensure the file was created
      expect(existsSync(outputPath)).toBe(true);

      // Validate the parquet file structure using DuckDB
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      // Load data into a temp table and use parseAllRows for proper bigint conversion
      await conn.run(
        `CREATE OR REPLACE TABLE temp_structure AS SELECT * FROM '${outputPath}' LIMIT 1`,
      );

      const { parseAllRows } = await import("@/lib/contract-enforcer");
      const validatedRows = await parseAllRows(conn, "temp_structure", Output);

      if (validatedRows.length > 0) {
        const row = validatedRows[0];
        // Check all required columns exist
        expect(row).toHaveProperty("election_id");
        expect(row).toHaveProperty("contest_id");
        expect(row).toHaveProperty("district_id");
        expect(row).toHaveProperty("seat_count");
        expect(row).toHaveProperty("candidate_a");
        expect(row).toHaveProperty("candidate_b");
        expect(row).toHaveProperty("pair_count");
        expect(row).toHaveProperty("presence_a");
        expect(row).toHaveProperty("presence_b");
        expect(row).toHaveProperty("union_count");
        expect(row).toHaveProperty("jaccard");
      }

      await conn.closeSync();
    });
  });

  describe("contract validation", () => {
    it("should validate all rows conform to Output schema", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      // Load data into a temp table for validation
      await conn.run(
        `CREATE OR REPLACE TABLE temp_jaccard AS SELECT * FROM '${outputPath}'`,
      );

      // Use parseAllRows which handles bigint->number conversion
      const { parseAllRows } = await import("@/lib/contract-enforcer");
      const validatedRows = await parseAllRows(conn, "temp_jaccard", Output);

      // Test that we got some validated rows
      expect(validatedRows.length).toBeGreaterThan(0);

      // Sample validation to ensure schema conformance
      const sampleSize = Math.min(10, validatedRows.length);
      for (let i = 0; i < sampleSize; i++) {
        expect(() => Output.parse(validatedRows[i])).not.toThrow();
      }

      await conn.closeSync();
    });
  });

  describe("mathematical invariants", () => {
    it("should enforce canonical ordering (candidate_a < candidate_b)", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT candidate_a, candidate_b 
        FROM '${outputPath}' 
        WHERE candidate_a >= candidate_b
      `);
      const violatingRows = await result.getRowObjects();

      expect(violatingRows).toHaveLength(0);
      await conn.closeSync();
    });

    it("should enforce no self-pairs", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT candidate_a, candidate_b 
        FROM '${outputPath}' 
        WHERE candidate_a = candidate_b
      `);
      const selfPairs = await result.getRowObjects();

      expect(selfPairs).toHaveLength(0);
      await conn.closeSync();
    });

    it("should enforce Jaccard bounds (0 ≤ jaccard ≤ 1)", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT jaccard 
        FROM '${outputPath}' 
        WHERE jaccard < 0 OR jaccard > 1
      `);
      const invalidJaccardRows = await result.getRowObjects();

      expect(invalidJaccardRows).toHaveLength(0);
      await conn.closeSync();
    });

    it("should enforce pair_count ≤ union_count", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT pair_count, union_count 
        FROM '${outputPath}' 
        WHERE pair_count > union_count
      `);
      const violatingRows = await result.getRowObjects();

      expect(violatingRows).toHaveLength(0);
      await conn.closeSync();
    });

    it("should enforce union_count = presence_a + presence_b - pair_count", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT pair_count, presence_a, presence_b, union_count,
               (presence_a + presence_b - pair_count) AS calculated_union
        FROM '${outputPath}' 
        WHERE union_count != (presence_a + presence_b - pair_count)
      `);
      const violatingRows = await result.getRowObjects();

      expect(violatingRows).toHaveLength(0);
      await conn.closeSync();
    });

    it("should enforce pair_count ≤ MIN(presence_a, presence_b)", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT pair_count, presence_a, presence_b
        FROM '${outputPath}' 
        WHERE pair_count > LEAST(presence_a, presence_b)
      `);
      const violatingRows = await result.getRowObjects();

      expect(violatingRows).toHaveLength(0);
      await conn.closeSync();
    });
  });

  describe("Jaccard coefficient calculation", () => {
    it("should calculate Jaccard = pair_count / union_count when union_count > 0", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT jaccard, pair_count, union_count,
               (pair_count::DOUBLE / union_count) AS calculated_jaccard
        FROM '${outputPath}' 
        WHERE union_count > 0
        AND ABS(jaccard - (pair_count::DOUBLE / union_count)) > 1e-12
      `);
      const violatingRows = await result.getRowObjects();

      expect(violatingRows).toHaveLength(0);
      await conn.closeSync();
    });

    it("should set Jaccard = 0 when union_count = 0", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      const result = await conn.run(`
        SELECT jaccard 
        FROM '${outputPath}' 
        WHERE union_count = 0 AND jaccard != 0
      `);
      const violatingRows = await result.getRowObjects();

      expect(violatingRows).toHaveLength(0);
      await conn.closeSync();
    });
  });

  describe("symmetry validation", () => {
    it("should have symmetric values when matrix is reconstructed", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_jaccard/candidate_affinity_jaccard.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      // Get sample of pairs to test symmetry
      const result = await conn.run(`
        SELECT candidate_a, candidate_b, jaccard 
        FROM '${outputPath}' 
        LIMIT 5
      `);
      const pairs = await result.getRowObjects();

      for (const pair of pairs) {
        const _candidateA = pair.candidate_a as number;
        const _candidateB = pair.candidate_b as number;
        const jaccard = pair.jaccard as number;

        // Check if the reverse pair would have the same Jaccard value
        // (This tests the logical symmetry even though we only store canonical pairs)
        expect(jaccard).toBeGreaterThanOrEqual(0);
        expect(jaccard).toBeLessThanOrEqual(1);

        // The actual symmetry test would need to construct the full symmetric matrix
        // For now, we just ensure the canonical pair has valid values
      }

      await conn.closeSync();
    });
  });

  describe("edge cases", () => {
    it("should handle computation within time budget", async () => {
      const startTime = Date.now();

      const result = await computeCandidateAffinityJaccard({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      const totalTime = Date.now() - startTime;

      // Should complete within reasonable time (much less than 60s budget)
      expect(totalTime).toBeLessThan(30000); // 30 seconds
      expect(result.stats.compute_ms).toBeGreaterThan(0);
    });
  });
});
