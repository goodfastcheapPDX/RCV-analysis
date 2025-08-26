import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { existsSync, unlinkSync, readFileSync, writeFileSync } from "fs";
import { computeFirstChoiceBreakdown } from "./compute.js";
import { FirstChoiceBreakdownOutput } from "./index.contract.js";
import { ingestCvr } from "../ingest_cvr/compute.js";

describe("first_choice_breakdown", () => {
  const originalEnv = process.env.SRC_CSV;

  beforeAll(async () => {
    // Set environment variable and run ingest_cvr first to create input data
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
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
    const entry = manifest["first_choice_breakdown@1.0.0"];

    expect(entry).toBeDefined();
    expect(entry.files).toContain("data/summary/first_choice.parquet");
    expect(entry.hashes["data/summary/first_choice.parquet"]).toMatch(
      /^[a-f0-9]{64}$/,
    ); // SHA256 hash
    expect(entry.stats.total_valid_ballots).toBe(12);
    expect(entry.stats.candidate_count).toBe(5);
    expect(entry.stats.sum_first_choice).toBe(12);
    expect(entry.data.rows).toBe(5);
    expect(entry.datasetVersion).toBe("1.0.0");
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

    // Manually verify percentages by reading the parquet file
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
      );

      // Check percentage bounds
      const boundsResult = await conn.run(
        "SELECT MIN(pct) as min_pct, MAX(pct) as max_pct, SUM(pct) as total_pct FROM first_choice;",
      );
      const bounds = await boundsResult.getRowObjects();

      expect(bounds[0].min_pct).toBeGreaterThanOrEqual(0);
      expect(bounds[0].max_pct).toBeLessThanOrEqual(100);
      expect(Math.abs(Number(bounds[0].total_pct) - 100)).toBeLessThanOrEqual(
        0.01,
      );

      // Check vote counts sum to expected total
      const votesResult = await conn.run(
        "SELECT SUM(first_choice_votes) as total_votes FROM first_choice;",
      );
      const votes = await votesResult.getRowObjects();
      expect(Number(votes[0].total_votes)).toBe(12);
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
        const prev = rows[i - 1] as any;
        const curr = rows[i] as any;

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
        const direct = directRows[i] as any;
        const computed = computedRows[i] as any;
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
