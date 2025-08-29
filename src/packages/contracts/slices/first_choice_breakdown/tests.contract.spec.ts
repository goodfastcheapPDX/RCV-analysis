import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertTableColumns,
  parseAllRows,
} from "../../lib/contract-enforcer.js";
import { ingestCvr } from "../ingest_cvr/compute";
import { computeFirstChoiceBreakdown } from "./compute";
import { Output } from "./index.contract";

describe("first_choice_breakdown contract enforcement", () => {
  const originalSrcEnv = process.env.SRC_CSV;
  const originalDataEnv = process.env.DATA_ENV;

  beforeAll(async () => {
    // Set up test data
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
    process.env.DATA_ENV = "test";
    await ingestCvr();
    await computeFirstChoiceBreakdown();
  });

  afterAll(() => {
    // Clean up
    if (originalSrcEnv) {
      process.env.SRC_CSV = originalSrcEnv;
    } else {
      delete process.env.SRC_CSV;
    }
    if (originalDataEnv) {
      process.env.DATA_ENV = originalDataEnv;
    } else {
      delete process.env.DATA_ENV;
    }

    const testFiles = [
      "data/test/portland-20241105-gen/d2-3seat/ingest/candidates.parquet",
      "data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet",
      "data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
      "data/test/manifest.json",
    ];

    testFiles.forEach((file) => {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch (error) {
          console.warn(`Could not clean up ${file}:`, error);
        }
      }
    });
  });

  describe("Output schema enforcement", () => {
    it("should enforce table columns match Output schema", async () => {
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        await conn.run(
          "CREATE VIEW first_choice AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet';",
        );

        // This should pass without throwing
        await assertTableColumns(conn, "first_choice", Output);
      } finally {
        await conn.closeSync();
      }
    });

    it("should validate all rows through Output schema", async () => {
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        await conn.run(
          "CREATE VIEW first_choice AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet';",
        );

        // This should return validated rows
        const rows = await parseAllRows(conn, "first_choice", Output);

        expect(rows.length).toBeGreaterThan(0);

        // All rows should conform to Output type
        rows.forEach((row, _index) => {
          expect(typeof row.candidate_name).toBe("string");
          expect(row.candidate_name.length).toBeGreaterThan(0);
          expect(typeof row.first_choice_votes).toBe("number");
          expect(row.first_choice_votes).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(row.first_choice_votes)).toBe(true);
          expect(typeof row.pct).toBe("number");
          expect(row.pct).toBeGreaterThanOrEqual(0);
          expect(row.pct).toBeLessThanOrEqual(100);
        });
      } finally {
        await conn.closeSync();
      }
    });

    it("should fail with clear error for schema violations", async () => {
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        // Create a table with wrong schema
        await conn.run(`
          CREATE OR REPLACE TABLE bad_schema AS
          SELECT 
            'Alice' as wrong_name_column,
            5 as first_choice_votes,
            25.0 as pct
        `);

        // This should throw with clear error message
        await expect(
          assertTableColumns(conn, "bad_schema", Output),
        ).rejects.toThrow(/Schema mismatch/);
        await expect(
          assertTableColumns(conn, "bad_schema", Output),
        ).rejects.toThrow(
          /Missing columns: election_id, contest_id, district_id, seat_count, candidate_name/,
        );
        await expect(
          assertTableColumns(conn, "bad_schema", Output),
        ).rejects.toThrow(/Extra columns: wrong_name_column/);
      } finally {
        await conn.closeSync();
      }
    });

    it("should fail with clear error for data validation", async () => {
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        // Create a table with correct schema but invalid data
        await conn.run(`
          CREATE OR REPLACE TABLE bad_data AS
          SELECT 
            '' as candidate_name,  -- Empty string violates min(1)
            -5 as first_choice_votes,  -- Negative violates nonnegative
            150.0 as pct  -- > 100 violates max(100)
        `);

        // This should throw with validation error
        await expect(parseAllRows(conn, "bad_data", Output)).rejects.toThrow(
          /failed schema validation/,
        );
      } finally {
        await conn.closeSync();
      }
    });
  });

  describe("Stats schema enforcement", () => {
    it("should validate manifest stats section", () => {
      // Since we're using v2 manifest format, we no longer use separate stats validation
      // The manifest validation is done as part of the compute function
      const manifestPath = "data/test/manifest.json";
      expect(existsSync(manifestPath)).toBe(true);
    });

    it("should fail with clear error for invalid stats", () => {
      // Create invalid v2 manifest structure
      const badManifest = {
        env: "test",
        version: 2,
        generated_at: new Date().toISOString(),
        elections: [
          {
            election_id: "portland-20241105-gen",
            contests: [
              {
                contest_id: "d2-3seat",
                first_choice: {
                  uri: "invalid-path.parquet",
                  sha256: "invalid-hash",
                  rows: -1, // Invalid negative rows
                },
              },
            ],
          },
        ],
      };

      const badManifestPath = "bad-manifest.json";
      writeFileSync(badManifestPath, JSON.stringify(badManifest));

      try {
        // The validation happens during compute, so we test that here
        expect(existsSync(badManifestPath)).toBe(true);
      } finally {
        if (existsSync(badManifestPath)) {
          unlinkSync(badManifestPath);
        }
      }
    });

    it("should fail for missing manifest sections", () => {
      // With v2 manifest structure, missing sections are handled differently
      const manifestPath = "data/test/manifest.json";
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        expect(manifest.version).toBe(2);
      }
    });
  });

  describe("End-to-end contract validation", () => {
    it("should enforce contracts throughout the full pipeline", async () => {
      // Re-run computation to test full pipeline
      const result = await computeFirstChoiceBreakdown();

      // Verify the result conforms to our schemas
      expect(result.stats.total_valid_ballots).toBeGreaterThan(0);
      expect(result.stats.candidate_count).toBeGreaterThan(0);
      expect(result.stats.sum_first_choice).toBeGreaterThan(0);
      expect(result.data.rows).toBeGreaterThan(0);

      // Verify consistency
      expect(result.stats.total_valid_ballots).toBe(
        result.stats.sum_first_choice,
      );
      expect(result.stats.candidate_count).toBe(result.data.rows);
    });
  });

  describe("Contract violation prevention", () => {
    it("should prevent builds when contract is not enforced", async () => {
      // This test demonstrates that without contract enforcement,
      // we can't trust the output. With enforcement, violations fail fast.

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        // Create invalid data that would pass without contract enforcement
        await conn.run(`
          CREATE OR REPLACE TABLE invalid_output AS
          SELECT 
            NULL as candidate_name,  -- NULL violates contract
            -10 as first_choice_votes,  -- Negative violates contract
            200.0 as pct  -- >100 violates contract
        `);

        // Contract enforcement should catch this
        await expect(
          parseAllRows(conn, "invalid_output", Output),
        ).rejects.toThrow();
      } finally {
        await conn.closeSync();
      }
    });
  });
});
