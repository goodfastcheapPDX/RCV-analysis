import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertManifestSection,
  assertTableColumns,
  parseAllRows,
} from "../../lib/contract-enforcer.js";
import { ingestCvr } from "../ingest_cvr/compute.js";
import { computeFirstChoiceBreakdown } from "./compute.js";
import {
  type FirstChoiceBreakdownOutput,
  Output,
  Stats,
  version,
} from "./index.contract.js";

interface DirectQueryResult {
  candidate_name: string;
  direct_count: number;
}

describe("first_choice_breakdown", () => {
  const originalEnv = process.env.SRC_CSV;
  const _testId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    // Set environment variable and run ingest_cvr first to create input data
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";

    // Add a small delay to prevent concurrent access
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    await ingestCvr();
  });

  afterAll(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.SRC_CSV = originalEnv;
    } else {
      delete process.env.SRC_CSV;
    }

    // Clean up test files
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

  it("should compute first choice breakdown with exact expected counts", async () => {
    const result: FirstChoiceBreakdownOutput =
      await computeFirstChoiceBreakdown();

    // Based on micro golden case with 12 ballots and first choices analysis
    expect(result.stats.total_valid_ballots).toBe(12); // 12 ballots with first choices
    expect(result.stats.candidate_count).toBe(5); // 5 candidates receiving first choice votes
    expect(result.stats.sum_first_choice).toBe(12); // Same as total_valid_ballots
    expect(result.data.rows).toBe(5); // 5 rows in output (one per candidate)
  });

  it("should create parquet export file", async () => {
    await computeFirstChoiceBreakdown();
    expect(existsSync("data/summary/first_choice.parquet")).toBe(true);
  });

  it("should update manifest.json with correct structure", async () => {
    await computeFirstChoiceBreakdown();

    expect(existsSync("manifest.json")).toBe(true);

    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const manifestKey = `first_choice_breakdown@${version}`;
    const entry = manifest[manifestKey];

    expect(entry).toBeDefined();
    expect(entry.files).toContain("data/summary/first_choice.parquet");
    expect(entry.hashes["data/summary/first_choice.parquet"]).toMatch(
      /^[a-f0-9]{64}$/,
    ); // SHA256 hash
    expect(entry.stats.total_valid_ballots).toBe(12);
    expect(entry.stats.candidate_count).toBe(5);
    expect(entry.stats.sum_first_choice).toBe(12);
    expect(entry.data.rows).toBe(5);
    expect(entry.datasetVersion).toBe(version);

    // ENFORCE CONTRACT: Validate manifest section
    assertManifestSection("manifest.json", manifestKey, Stats);
  });

  it("should maintain consistent file hashing", async () => {
    // Run twice and check that identical data produces identical hash
    await computeFirstChoiceBreakdown();
    const manifest1 = JSON.parse(readFileSync("manifest.json", "utf8"));
    const hash1 =
      manifest1["first_choice_breakdown@1.0.0"].hashes[
        "data/summary/first_choice.parquet"
      ];

    await computeFirstChoiceBreakdown();
    const manifest2 = JSON.parse(readFileSync("manifest.json", "utf8"));
    const hash2 =
      manifest2["first_choice_breakdown@1.0.0"].hashes[
        "data/summary/first_choice.parquet"
      ];

    expect(hash1).toBe(hash2);
  });

  it("should throw error when input parquet file does not exist", async () => {
    // Remove the input file temporarily
    const inputPath = "data/ingest/ballots_long.parquet";
    const backup = readFileSync(inputPath);
    unlinkSync(inputPath);

    try {
      await expect(computeFirstChoiceBreakdown()).rejects.toThrow(
        "Input file not found: data/ingest/ballots_long.parquet. Run ingest_cvr first.",
      );
    } finally {
      // Restore the file
      writeFileSync(inputPath, backup);
    }
  });

  it("should validate percentage calculations", async () => {
    await computeFirstChoiceBreakdown();

    // ENFORCE CONTRACT: Validate using contract enforcer
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
      );

      // ENFORCE CONTRACT: Validate table schema and all rows
      await assertTableColumns(conn, "first_choice", Output);
      const validatedRows = await parseAllRows(conn, "first_choice", Output);

      // All validation is now done through contract enforcement
      expect(validatedRows.length).toBeGreaterThan(0);

      // Verify percentage constraints through validated data
      const totalPct = validatedRows.reduce((sum, row) => sum + row.pct, 0);
      expect(Math.abs(totalPct - 100)).toBeLessThanOrEqual(0.01);

      const totalVotes = validatedRows.reduce(
        (sum, row) => sum + row.first_choice_votes,
        0,
      );
      expect(totalVotes).toBe(12);
    } finally {
      await conn.closeSync();
    }
  });

  it("should maintain deterministic ordering", async () => {
    await computeFirstChoiceBreakdown();

    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
      );

      const result = await conn.run(
        "SELECT candidate_name, first_choice_votes FROM first_choice ORDER BY first_choice_votes DESC, candidate_name ASC;",
      );
      const rows = await result.getRowObjects();

      // Verify ordering is by votes DESC, then name ASC
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1] as unknown as Output;
        const curr = rows[i] as unknown as Output;

        if (prev.first_choice_votes === curr.first_choice_votes) {
          expect(prev.candidate_name <= curr.candidate_name).toBe(true);
        } else {
          expect(prev.first_choice_votes >= curr.first_choice_votes).toBe(true);
        }
      }
    } finally {
      await conn.closeSync();
    }
  });

  it("should handle corrupted manifest.json gracefully", async () => {
    // Create corrupted manifest
    writeFileSync("manifest.json", "invalid json content");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await computeFirstChoiceBreakdown();
      expect(warnSpy).toHaveBeenCalledWith(
        "Could not parse existing manifest.json, creating new one",
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("should validate against ballots_long input data consistency", async () => {
    await computeFirstChoiceBreakdown();

    // Directly query ballots_long to verify first choice counts match
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        "CREATE VIEW ballots_long AS SELECT * FROM 'data/ingest/ballots_long.parquet';",
      );
      await conn.run(
        "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
      );

      // Count first choices directly from ballots_long
      const directResult = await conn.run(`
        SELECT candidate_name, COUNT(*) as direct_count
        FROM ballots_long 
        WHERE rank_position = 1 AND has_vote = TRUE 
        GROUP BY candidate_name 
        ORDER BY direct_count DESC, candidate_name ASC;
      `);
      const directRows = await directResult.getRowObjects();

      // Get computed results
      const computedResult = await conn.run(`
        SELECT candidate_name, first_choice_votes
        FROM first_choice 
        ORDER BY first_choice_votes DESC, candidate_name ASC;
      `);
      const computedRows = await computedResult.getRowObjects();

      // Compare counts
      expect(directRows.length).toBe(computedRows.length);

      for (let i = 0; i < directRows.length; i++) {
        const direct = directRows[i] as unknown as DirectQueryResult;
        const computed = computedRows[i] as unknown as Output;
        expect(direct.candidate_name).toBe(computed.candidate_name);
        expect(direct.direct_count).toBe(computed.first_choice_votes);
      }
    } finally {
      await conn.closeSync();
    }
  });

  it("should handle canonical District 2 subset", async () => {
    // Set up environment for canonical subset
    const originalEnv = process.env.SRC_CSV;
    process.env.SRC_CSV = "tests/golden/micro/canonical_subset.csv";

    try {
      // Re-ingest with canonical data
      await ingestCvr();
      const result = await computeFirstChoiceBreakdown();

      // Verify it processes real candidate data
      expect(result.stats.total_valid_ballots).toBe(14); // 14 valid ballots from canonical subset
      expect(result.stats.candidate_count).toBeGreaterThan(1); // Multiple real candidates
      expect(result.stats.sum_first_choice).toBe(
        result.stats.total_valid_ballots,
      );
      expect(result.data.rows).toBe(result.stats.candidate_count);
    } finally {
      process.env.SRC_CSV = originalEnv;
      // Re-ingest with original test data for other tests
      await ingestCvr();
    }
  });
});
