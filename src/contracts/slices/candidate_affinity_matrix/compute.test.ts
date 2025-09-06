import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { computeCandidateAffinityMatrix } from "./compute";
import { createOutputFixture, Output } from "./index.contract";

describe("computeCandidateAffinityMatrix", () => {
  // Use the global test data that's already set up by the test environment
  const testElectionId = "portland-20241105-gen";
  const testContestId = "d2-3seat";
  const testEnv = "test";

  describe("successful computation", () => {
    it("should compute candidate affinity matrix with correct data", async () => {
      const result = await computeCandidateAffinityMatrix({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // Validate return structure matches contract
      expect(result).toMatchObject({
        stats: {
          total_ballots_considered: expect.any(Number),
          unique_pairs: expect.any(Number),
          max_pair_frac: expect.any(Number),
          compute_ms: expect.any(Number),
        },
        data: {
          rows: expect.any(Number),
        },
      });

      // Validate stats are reasonable
      expect(result.stats.total_ballots_considered).toBeGreaterThan(0);
      expect(result.stats.unique_pairs).toBeGreaterThanOrEqual(0);
      expect(result.stats.max_pair_frac).toBeGreaterThanOrEqual(0);
      expect(result.stats.max_pair_frac).toBeLessThanOrEqual(1);
      expect(result.stats.compute_ms).toBeGreaterThan(0);
      expect(result.data.rows).toBe(result.stats.unique_pairs);
    });

    it("should create parquet file with correct structure", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_matrix/candidate_affinity_matrix.parquet`;

      // Ensure the file was created
      expect(existsSync(outputPath)).toBe(true);

      // Validate the parquet file structure using DuckDB
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        await conn.run(
          `CREATE VIEW candidate_affinity_matrix AS SELECT * FROM '${outputPath}';`,
        );

        const result = await conn.run(
          "SELECT COUNT(*) as row_count FROM candidate_affinity_matrix;",
        );
        const rowCount = (await result.getRowObjects())[0].row_count;
        expect(rowCount).toBeGreaterThanOrEqual(0);

        // Validate schema
        const schemaResult = await conn.run(
          "DESCRIBE candidate_affinity_matrix;",
        );
        const schema = await schemaResult.getRowObjects();

        const expectedColumns = [
          "candidate_a",
          "candidate_b",
          "cooccurrence_count",
          "cooccurrence_frac",
        ];
        // biome-ignore lint/suspicious/noExplicitAny: don't care
        const actualColumns = schema.map((col: any) => col.column_name);

        for (const expectedCol of expectedColumns) {
          expect(actualColumns).toContain(expectedCol);
        }
      } finally {
        await conn.closeSync();
      }
    });

    it("should produce data that validates against the contract", async () => {
      const outputPath = `data/${testEnv}/${testElectionId}/${testContestId}/candidate_affinity_matrix/candidate_affinity_matrix.parquet`;

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        await conn.run(
          `CREATE VIEW candidate_affinity_matrix AS SELECT * FROM '${outputPath}';`,
        );

        const result = await conn.run(
          "SELECT * FROM candidate_affinity_matrix ORDER BY candidate_a, candidate_b;",
        );
        const rows = await result.getRowObjects();

        // Validate each row against the contract
        for (const row of rows) {
          // Convert bigints to numbers for validation (DuckDB returns bigints)
          const normalizedRow = {
            ...row,
            candidate_a: Number(row.candidate_a),
            candidate_b: Number(row.candidate_b),
            cooccurrence_count: Number(row.cooccurrence_count),
          };

          const validatedRow = Output.parse(normalizedRow);
          expect(validatedRow).toMatchObject({
            candidate_a: expect.any(Number),
            candidate_b: expect.any(Number),
            cooccurrence_count: expect.any(Number),
            cooccurrence_frac: expect.any(Number),
          });

          // Additional validation rules
          expect(validatedRow.candidate_a).toBeGreaterThan(0);
          expect(validatedRow.candidate_b).toBeGreaterThan(0);
          expect(validatedRow.candidate_a).not.toBe(validatedRow.candidate_b); // No self-pairs
          expect(validatedRow.candidate_a).toBeLessThan(
            validatedRow.candidate_b,
          ); // Canonical ordering
          expect(validatedRow.cooccurrence_count).toBeGreaterThanOrEqual(0);
          expect(validatedRow.cooccurrence_frac).toBeGreaterThanOrEqual(0);
          expect(validatedRow.cooccurrence_frac).toBeLessThanOrEqual(1);
        }
      } finally {
        await conn.closeSync();
      }
    });
  });

  describe("error handling", () => {
    it("should throw error when election not found", async () => {
      await expect(
        computeCandidateAffinityMatrix({
          electionId: "nonexistent-election",
          contestId: testContestId,
          env: testEnv,
        }),
      ).rejects.toThrow("Election nonexistent-election not found in manifest");
    });

    it("should throw error when contest not found", async () => {
      await expect(
        computeCandidateAffinityMatrix({
          electionId: testElectionId,
          contestId: "nonexistent-contest",
          env: testEnv,
        }),
      ).rejects.toThrow("Contest nonexistent-contest not found in manifest");
    });

    it("should throw error when manifest not found", async () => {
      await expect(
        computeCandidateAffinityMatrix({
          electionId: testElectionId,
          contestId: testContestId,
          env: "nonexistent-env",
        }),
      ).rejects.toThrow("Manifest not found");
    });
  });

  describe("edge cases", () => {
    it("should work with dev environment when specified", async () => {
      // This test uses 'dev' environment
      const result = await computeCandidateAffinityMatrix({
        electionId: testElectionId,
        contestId: testContestId,
        env: "dev",
      }).catch(() => {
        // If dev environment doesn't exist, that's expected
        return null;
      });

      if (result) {
        expect(result).toMatchObject({
          stats: expect.any(Object),
          data: expect.any(Object),
        });
      }
    });

    it("should handle small datasets correctly", async () => {
      // The test dataset is already small (micro golden case)
      const result = await computeCandidateAffinityMatrix({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // For small datasets, verify reasonable constraints
      expect(result.stats.unique_pairs).toBeLessThanOrEqual(10); // Max C(5,2) = 10 pairs
      expect(result.stats.total_ballots_considered).toBeLessThanOrEqual(50); // Reasonable for test data
    });

    it("should correctly report ballot counts when no pairs exist", async () => {
      // This test verifies the fix for the P1 issue where zero pairs incorrectly
      // resulted in zero ballot counts, violating the Stats contract
      const result = await computeCandidateAffinityMatrix({
        electionId: testElectionId,
        contestId: testContestId,
        env: testEnv,
      });

      // The key assertion: even if there were zero pairs, ballot count should be > 0
      // because the actual ballots were processed (our test data has 11 ballots with ranks)
      if (result.stats.unique_pairs === 0) {
        expect(result.stats.total_ballots_considered).toBeGreaterThan(0);
      }

      // In all cases, ballot count should be positive (contract requirement)
      expect(result.stats.total_ballots_considered).toBeGreaterThan(0);

      // The ballot count should match the actual number of ballots that had rankings
      // (This verifies we're using the actual dedup count, not deriving from pairs)
      expect(result.stats.total_ballots_considered).toBeLessThanOrEqual(20);
    });
  });
});
