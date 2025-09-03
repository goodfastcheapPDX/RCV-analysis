import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIdentity } from "@/contracts/ids";
import type { Manifest } from "@/contracts/manifest";
import { sha256 } from "@/lib/contract-enforcer";
import { computeTransferMatrix } from "./compute";
import {
  createDataFixture,
  createExhaustedFixture,
  createOutputFixture,
  createStatsFixture,
  createTransferMatrixOutputFixture,
} from "./index.contract";

describe("computeTransferMatrix", () => {
  const testIdentity = createIdentity(
    "portland-20241105-gen",
    "d2-3seat",
    "d2",
    3,
  );

  const testOutputPath = "data/test/portland-20241105-gen/d2-3seat";

  beforeEach(() => {
    // Ensure test directories exist
    mkdirSync(`${testOutputPath}/transfer_matrix`, { recursive: true });
    mkdirSync(`${testOutputPath}/stv`, { recursive: true });
    mkdirSync(`${testOutputPath}/ingest`, { recursive: true });
  });

  afterEach(() => {
    // Clean up any test files that might interfere with other tests
    // Note: We don't delete the main test data since other tests depend on it
  });

  describe("with existing STV data", () => {
    it("should compute transfer matrix from STV rounds and meta data", async () => {
      // This test uses the existing test data setup from global test setup
      // Requires stv/rounds.parquet, stv/meta.parquet, and ingest/ballots_long.parquet

      const result = await computeTransferMatrix(testIdentity);

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.data).toBeDefined();

      // Validate stats structure
      expect(result.stats.total_rounds).toBeGreaterThanOrEqual(1);
      expect(result.stats.total_transfers).toBeGreaterThanOrEqual(0);
      expect(result.stats.total_exhausted_votes).toBeGreaterThanOrEqual(0);
      expect(result.stats.candidates_with_transfers).toBeGreaterThanOrEqual(0);
      expect(result.stats.surplus_transfers).toBeGreaterThanOrEqual(0);
      expect(result.stats.elimination_transfers).toBeGreaterThanOrEqual(0);

      // Validate data structure
      expect(result.data.rows).toBeGreaterThanOrEqual(0);
      expect(result.data.rows).toBe(result.stats.total_transfers);

      // Validate that transfer matrix file was created
      expect(
        existsSync(`${testOutputPath}/transfer_matrix/transfer_matrix.parquet`),
      ).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should throw error when STV rounds data is missing", async () => {
      const missingRoundsIdentity = createIdentity(
        "missing-20241105-gen",
        "d1-1seat",
        "d1",
        1,
      );

      await expect(
        computeTransferMatrix(missingRoundsIdentity),
      ).rejects.toThrow(/Required input not found.*rounds\.parquet/);
    });

    it("should throw error when STV meta data is missing", async () => {
      // Create a test scenario where rounds exists but meta doesn't
      const partialDataPath = "data/test/partial-20241105-gen/d1-1seat";
      mkdirSync(`${partialDataPath}/stv`, { recursive: true });
      mkdirSync(`${partialDataPath}/ingest`, { recursive: true });

      // Copy existing rounds file but don't create meta file
      const existingRoundsPath = `${testOutputPath}/stv/rounds.parquet`;
      const testRoundsPath = `${partialDataPath}/stv/rounds.parquet`;
      const existingBallotsPath = `${testOutputPath}/ingest/ballots_long.parquet`;
      const testBallotsPath = `${partialDataPath}/ingest/ballots_long.parquet`;

      if (existsSync(existingRoundsPath)) {
        writeFileSync(testRoundsPath, readFileSync(existingRoundsPath));
      }
      if (existsSync(existingBallotsPath)) {
        writeFileSync(testBallotsPath, readFileSync(existingBallotsPath));
      }

      const partialIdentity = createIdentity(
        "partial-20241105-gen",
        "d1-1seat",
        "d1",
        1,
      );

      await expect(computeTransferMatrix(partialIdentity)).rejects.toThrow(
        /Required input not found.*meta\.parquet/,
      );
    });

    it("should throw error when ballots_long data is missing", async () => {
      // Create a test scenario where STV data exists but ballots_long doesn't
      const partialDataPath = "data/test/partial2-20241105-gen/d1-1seat";
      mkdirSync(`${partialDataPath}/stv`, { recursive: true });
      mkdirSync(`${partialDataPath}/ingest`, { recursive: true });

      // Copy existing STV files but don't create ballots_long file
      const existingRoundsPath = `${testOutputPath}/stv/rounds.parquet`;
      const testRoundsPath = `${partialDataPath}/stv/rounds.parquet`;
      const existingMetaPath = `${testOutputPath}/stv/meta.parquet`;
      const testMetaPath = `${partialDataPath}/stv/meta.parquet`;

      if (existsSync(existingRoundsPath)) {
        writeFileSync(testRoundsPath, readFileSync(existingRoundsPath));
      }
      if (existsSync(existingMetaPath)) {
        writeFileSync(testMetaPath, readFileSync(existingMetaPath));
      }

      const partialIdentity = createIdentity(
        "partial2-20241105-gen",
        "d1-1seat",
        "d1",
        1,
      );

      await expect(computeTransferMatrix(partialIdentity)).rejects.toThrow(
        /Required input not found.*ballots_long\.parquet/,
      );
    });
  });

  describe("data validation", () => {
    it("should enforce contract schemas throughout computation", async () => {
      // This test ensures that all data passes through schema validation
      // We rely on the default test setup which has already been run
      expect(existsSync(`${testOutputPath}/stv/rounds.parquet`)).toBe(true);
      expect(existsSync(`${testOutputPath}/stv/meta.parquet`)).toBe(true);
      expect(existsSync(`${testOutputPath}/ingest/ballots_long.parquet`)).toBe(
        true,
      );

      const result = await computeTransferMatrix(testIdentity);

      // Check that output file contains valid data by loading and validating it
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        // Load the generated transfer matrix file
        const transferMatrixPath = `${testOutputPath}/transfer_matrix/transfer_matrix.parquet`;
        await conn.run(
          `CREATE VIEW test_transfer_matrix AS SELECT * FROM '${transferMatrixPath}'`,
        );

        // Verify we can load the data (if schema is wrong, this will fail)
        const transferMatrixResult = await conn.run(
          "SELECT COUNT(*) as count FROM test_transfer_matrix",
        );
        const transferMatrixCount = (
          await transferMatrixResult.getRowObjects()
        )[0] as {
          count: bigint;
        };
        expect(Number(transferMatrixCount.count)).toBe(result.data.rows);

        // Validate required columns exist and have correct types
        await conn.run(`
          SELECT 
            election_id,
            contest_id,
            district_id,
            seat_count,
            round,
            from_candidate_name,
            to_candidate_name,
            vote_count,
            transfer_reason,
            transfer_weight
          FROM test_transfer_matrix 
          LIMIT 1
        `);

        // Validate business rules
        const validationResult = await conn.run(`
          SELECT 
            COUNT(*) as total_rows,
            COUNT(CASE WHEN vote_count < 0 THEN 1 END) as negative_votes,
            COUNT(CASE WHEN transfer_weight < 0 OR transfer_weight > 1 THEN 1 END) as invalid_weights,
            COUNT(CASE WHEN round <= 0 THEN 1 END) as invalid_rounds
          FROM test_transfer_matrix
        `);

        const validation = (await validationResult.getRowObjects())[0] as {
          total_rows: bigint;
          negative_votes: bigint;
          invalid_weights: bigint;
          invalid_rounds: bigint;
        };

        expect(Number(validation.negative_votes)).toBe(0);
        expect(Number(validation.invalid_weights)).toBe(0);
        expect(Number(validation.invalid_rounds)).toBe(0);
      } finally {
        await conn.closeSync();
      }
    });

    it("should generate consistent stats from actual data", async () => {
      const result = await computeTransferMatrix(testIdentity);

      // Load the actual data and verify stats are calculated correctly
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        const transferMatrixPath = `${testOutputPath}/transfer_matrix/transfer_matrix.parquet`;
        await conn.run(
          `CREATE VIEW verify_transfer_matrix AS SELECT * FROM '${transferMatrixPath}'`,
        );

        // Verify total_rounds matches the maximum round in the data
        const roundsResult = await conn.run(
          "SELECT MAX(round) as max_round FROM verify_transfer_matrix",
        );
        const maxRound = (await roundsResult.getRowObjects())[0] as {
          max_round: number | null;
        };
        if (maxRound.max_round !== null) {
          expect(result.stats.total_rounds).toBe(maxRound.max_round);
        }

        // Verify total_transfers matches actual row count
        const countResult = await conn.run(
          "SELECT COUNT(*) as count FROM verify_transfer_matrix",
        );
        const actualCount = (await countResult.getRowObjects())[0] as {
          count: bigint;
        };
        expect(result.stats.total_transfers).toBe(Number(actualCount.count));

        // Verify exhausted votes calculation
        const exhaustedResult = await conn.run(
          "SELECT SUM(vote_count) as total_exhausted FROM verify_transfer_matrix WHERE to_candidate_name IS NULL",
        );
        const exhaustedTotal = (await exhaustedResult.getRowObjects())[0] as {
          total_exhausted: number | null;
        };
        const expectedExhausted = exhaustedTotal.total_exhausted || 0;
        expect(result.stats.total_exhausted_votes).toBe(expectedExhausted);

        // Verify transfer type counts
        const transferTypesResult = await conn.run(`
          SELECT 
            transfer_reason,
            COUNT(*) as count
          FROM verify_transfer_matrix 
          GROUP BY transfer_reason
        `);
        const transferTypes = (await transferTypesResult.getRowObjects()) as {
          transfer_reason: string;
          count: bigint;
        }[];

        let surplusCount = 0;
        let eliminationCount = 0;
        for (const type of transferTypes) {
          if (type.transfer_reason === "surplus") {
            surplusCount = Number(type.count);
          } else if (type.transfer_reason === "elimination") {
            eliminationCount = Number(type.count);
          }
        }

        expect(result.stats.surplus_transfers).toBe(surplusCount);
        expect(result.stats.elimination_transfers).toBe(eliminationCount);
      } finally {
        await conn.closeSync();
      }
    });
  });

  describe("fixture validation", () => {
    it("should validate createOutputFixture produces valid Output schema", () => {
      const fixture = createOutputFixture();

      expect(fixture.election_id).toBeDefined();
      expect(fixture.contest_id).toBeDefined();
      expect(fixture.district_id).toBeDefined();
      expect(fixture.seat_count).toBeGreaterThan(0);
      expect(fixture.round).toBeGreaterThan(0);
      expect(fixture.from_candidate_name).toBeTruthy();
      expect(fixture.to_candidate_name).toBeTruthy();
      expect(fixture.vote_count).toBeGreaterThanOrEqual(0);
      expect(["elimination", "surplus"]).toContain(fixture.transfer_reason);
      expect(fixture.transfer_weight).toBeGreaterThanOrEqual(0);
      expect(fixture.transfer_weight).toBeLessThanOrEqual(1);
    });

    it("should validate createExhaustedFixture produces valid exhausted transfer", () => {
      const fixture = createExhaustedFixture();

      expect(fixture.to_candidate_name).toBeNull();
      expect(fixture.vote_count).toBeGreaterThanOrEqual(0);
      expect(["elimination", "surplus"]).toContain(fixture.transfer_reason);
    });

    it("should validate createStatsFixture produces valid Stats schema", () => {
      const fixture = createStatsFixture();

      expect(fixture.total_rounds).toBeGreaterThan(0);
      expect(fixture.total_transfers).toBeGreaterThanOrEqual(0);
      expect(fixture.total_exhausted_votes).toBeGreaterThanOrEqual(0);
      expect(fixture.candidates_with_transfers).toBeGreaterThanOrEqual(0);
      expect(fixture.surplus_transfers).toBeGreaterThanOrEqual(0);
      expect(fixture.elimination_transfers).toBeGreaterThanOrEqual(0);
    });

    it("should validate createDataFixture produces valid Data schema", () => {
      const fixture = createDataFixture();

      expect(fixture.rows).toBeGreaterThanOrEqual(0);
    });

    it("should validate createTransferMatrixOutputFixture produces valid output", () => {
      const fixture = createTransferMatrixOutputFixture();

      expect(fixture.stats).toBeDefined();
      expect(fixture.data).toBeDefined();
      expect(fixture.stats.total_rounds).toBeGreaterThan(0);
      expect(fixture.data.rows).toBeGreaterThanOrEqual(0);
    });
  });

  describe("database operations", () => {
    it("should handle database cleanup on error", async () => {
      // Create a scenario that will cause a database error during processing
      const badIdentity = createIdentity(
        "nonexist-20241105-gen",
        "d1-1seat",
        "d1",
        1,
      );

      // The function should handle errors and cleanup database connections
      await expect(computeTransferMatrix(badIdentity)).rejects.toThrow();
      // If cleanup is working properly, this should not hang or leave connections open
    });
  });
});
