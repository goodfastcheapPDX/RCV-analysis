import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { Output, Stats, version } from "./index.contract.js";
import { ingestCvr } from "../ingest_cvr/compute.js";
import { computeFirstChoiceBreakdown } from "./compute.js";
import {
  assertTableColumns,
  parseAllRows,
  assertManifestSection,
} from "../../lib/contract-enforcer.js";

describe("first_choice_breakdown contract enforcement", () => {
  const originalEnv = process.env.SRC_CSV;

  beforeAll(async () => {
    // Set up test data
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
    await ingestCvr();
    await computeFirstChoiceBreakdown();
  });

  afterAll(() => {
    // Clean up
    if (originalEnv) {
      process.env.SRC_CSV = originalEnv;
    } else {
      delete process.env.SRC_CSV;
    }

    const testFiles = [
      "data/ingest/candidates.parquet",
      "data/ingest/ballots_long.parquet",
      "data/summary/first_choice.parquet",
      "manifest.json",
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
          "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
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
          "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
        );

        // This should return validated rows
        const rows = await parseAllRows(conn, "first_choice", Output);

        expect(rows.length).toBeGreaterThan(0);

        // All rows should conform to Output type
        rows.forEach((row, index) => {
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
        ).rejects.toThrow(/Missing columns: candidate_name/);
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
      const manifestKey = `first_choice_breakdown@${version}`;

      // This should pass without throwing
      expect(() => {
        assertManifestSection("manifest.json", manifestKey, Stats);
      }).not.toThrow();
    });

    it("should fail with clear error for invalid stats", () => {
      // Create a manifest with invalid stats
      const badManifest = {
        [`first_choice_breakdown@${version}`]: {
          stats: {
            total_valid_ballots: -5, // Negative violates nonnegative
            candidate_count: 0, // Zero violates positive
            sum_first_choice: "invalid", // String violates number
          },
        },
      };

      const badManifestPath = "bad-manifest.json";
      writeFileSync(badManifestPath, JSON.stringify(badManifest));

      try {
        const manifestKey = `first_choice_breakdown@${version}`;
        expect(() => {
          assertManifestSection(badManifestPath, manifestKey, Stats);
        }).toThrow(/Stats validation failed/);
      } finally {
        if (existsSync(badManifestPath)) {
          unlinkSync(badManifestPath);
        }
      }
    });

    it("should fail for missing manifest sections", () => {
      expect(() => {
        assertManifestSection("manifest.json", "nonexistent@1.0.0", Stats);
      }).toThrow(/Manifest missing key: nonexistent@1.0.0/);
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
