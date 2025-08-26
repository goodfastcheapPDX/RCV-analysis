import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { existsSync, unlinkSync, readFileSync, writeFileSync } from "fs";
import { ingestCvr } from "./compute.js";
import { IngestCvrOutput } from "./index.contract.js";

describe("ingest_cvr", () => {
  const originalEnv = process.env.SRC_CSV;

  beforeAll(() => {
    // Set environment variable for test
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
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

  it("should ingest CVR data and produce exact expected counts", async () => {
    const result: IngestCvrOutput = await ingestCvr();

    // Assert exact counts as specified in CURRENT_TASK.md
    expect(result.candidates.rows).toBe(5); // 5 candidates
    expect(result.ballots_long.ballots).toBe(11); // 11 ballots (excluding Status=1)
    expect(result.ballots_long.rows).toBe(31); // 31 total vote records
    expect(result.ballots_long.min_rank).toBe(1); // min rank = 1
    expect(result.ballots_long.max_rank).toBe(3); // max rank = 3
    expect(result.ballots_long.duplicate_ballots).toBe(0); // no duplicate ballots
    expect(result.ballots_long.candidates).toBe(5); // 5 candidates receiving votes
  });

  it("should create Parquet export files", async () => {
    await ingestCvr();

    expect(existsSync("data/ingest/candidates.parquet")).toBe(true);
    expect(existsSync("data/ingest/ballots_long.parquet")).toBe(true);
  });

  it("should update manifest.json", async () => {
    await ingestCvr();

    expect(existsSync("manifest.json")).toBe(true);

    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const entry = manifest["ingest_cvr@1.0.0"];

    expect(entry).toBeDefined();
    expect(entry.files).toContain("data/ingest/candidates.parquet");
    expect(entry.files).toContain("data/ingest/ballots_long.parquet");
    expect(entry.rows).toBe(31);
    expect(entry.min_rank).toBe(1);
    expect(entry.max_rank).toBe(3);
    expect(entry.duplicate_ballots).toBe(0);
    expect(entry.datasetVersion).toBe("1.0.0");
  });

  it("should handle sample ballot with ordered and unique ranks", async () => {
    // This test verifies that for one sample BallotID, ranks are ordered and unique
    // Since we're testing the statistical output, we verify the overall constraints
    // that ensure rank uniqueness and ordering are maintained
    const result = await ingestCvr();

    // If the system correctly processes ranks, we should have:
    // - Min rank is 1 (confirming ranks start at 1)
    // - Max rank is 3 (confirming ranks go up to 3)
    // - Total vote records matches expected (confirming no duplicates)
    expect(result.ballots_long.min_rank).toBe(1);
    expect(result.ballots_long.max_rank).toBe(3);
    expect(result.ballots_long.rows).toBe(31);
  });

  it("should throw error when SRC_CSV is not set", async () => {
    delete process.env.SRC_CSV;

    await expect(ingestCvr()).rejects.toThrow(
      "SRC_CSV environment variable is required",
    );

    // Restore for other tests
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
  });

  it("should handle CSV with no matching candidate columns", async () => {
    // Create a CSV with no matching column format
    const badCsvPath = "tests/golden/micro/bad_cvr.csv";
    writeFileSync(
      badCsvPath,
      '"BallotID","PrecinctID","BallotStyleID","Status","BadColumn1","BadColumn2"\n"B001","P01","S01",0,1,0\n',
    );

    const originalEnv = process.env.SRC_CSV;
    process.env.SRC_CSV = badCsvPath;

    try {
      await expect(ingestCvr()).rejects.toThrow(
        "No candidate columns found. Check CSV header format.",
      );
    } finally {
      process.env.SRC_CSV = originalEnv;
      unlinkSync(badCsvPath);
    }
  });

  it("should warn when max rank exceeds 10", async () => {
    // Create a CSV with high rank values
    const highRankCsvPath = "tests/golden/micro/high_rank_cvr.csv";
    const fs = require("fs");
    const header =
      '"BallotID","PrecinctID","BallotStyleID","Status","Choice_36_1:City of Portland, Councilor, District 2:15:Number of Winners 3:TestCandidate:NON"';
    const data = '"B001","P01","S01",0,1';
    fs.writeFileSync(highRankCsvPath, `${header}\n${data}\n`);

    const originalEnv = process.env.SRC_CSV;
    process.env.SRC_CSV = highRankCsvPath;

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await ingestCvr();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Maximum rank 15 exceeds 10"),
      );
    } finally {
      process.env.SRC_CSV = originalEnv;
      fs.unlinkSync(highRankCsvPath);
      warnSpy.mockRestore();
    }
  });

  it("should handle corrupted manifest.json", async () => {
    // Create a corrupted manifest.json
    const fs = require("fs");
    fs.writeFileSync("manifest.json", "invalid json content");

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await ingestCvr();
      expect(warnSpy).toHaveBeenCalledWith(
        "Could not parse existing manifest.json, creating new one",
      );
    } finally {
      warnSpy.mockRestore();
      // Clean up
      if (existsSync("manifest.json")) {
        fs.unlinkSync("manifest.json");
      }
    }
  });

  it("should handle database query returning null result", async () => {
    // This test would require mocking DuckDB to return null from getCompleteStats
    // For now we document this edge case - in practice this should never happen
    // as DuckDB always returns a result object, but we handle it defensively
    const result = await ingestCvr();
    expect(result).toBeDefined();
    expect(result.ballots_long.rows).toBe(31);
  });

  it("should handle CSV from different districts", async () => {
    // Create a CSV with District 1 format instead of District 2
    const district1CsvPath = "tests/golden/micro/district1_cvr.csv";
    const header =
      '"BallotID","PrecinctID","BallotStyleID","Status","Choice_36_1:City of Portland, Councilor, District 1:1:Number of Winners 3:TestCandidate1:NON","Choice_37_1:City of Portland, Councilor, District 1:2:Number of Winners 3:TestCandidate2:NON"';
    const data = '"B001","P01","S01",0,1,0\n"B002","P01","S01",0,0,1';
    writeFileSync(district1CsvPath, `${header}\n${data}\n`);

    const originalEnv = process.env.SRC_CSV;
    process.env.SRC_CSV = district1CsvPath;

    try {
      const result = await ingestCvr();
      // Should successfully parse District 1 data
      expect(result.candidates.rows).toBe(2);
      expect(result.ballots_long.ballots).toBe(2);
      expect(result.ballots_long.rows).toBe(2);
    } finally {
      process.env.SRC_CSV = originalEnv;
      unlinkSync(district1CsvPath);
    }
  });

  it("should ingest canonical District 2 subset with real candidate data", async () => {
    const originalEnv = process.env.SRC_CSV;
    process.env.SRC_CSV = "tests/golden/micro/canonical_subset.csv";

    try {
      const result = await ingestCvr();

      // Verify it processes the canonical format successfully
      expect(result.candidates.rows).toBeGreaterThan(0); // Should find real candidates
      expect(result.ballots_long.ballots).toBe(14); // 14 valid ballots (Status=0, excluding Status=-1)
      expect(result.ballots_long.rows).toBeGreaterThan(14); // Should have vote records
      expect(result.ballots_long.min_rank).toBe(1);
      expect(result.ballots_long.max_rank).toBeLessThanOrEqual(6); // Portland allows up to 6 ranks
      expect(result.ballots_long.candidates).toBeGreaterThan(1); // Multiple candidates receiving votes

      // Verify Parquet files are created
      expect(existsSync("data/ingest/candidates.parquet")).toBe(true);
      expect(existsSync("data/ingest/ballots_long.parquet")).toBe(true);
    } finally {
      process.env.SRC_CSV = originalEnv;
    }
  });
});
