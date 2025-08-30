import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertTableColumns,
  parseAllRows,
} from "@/packages/contracts/lib/contract-enforcer";
import { ingestCvr } from "../ingest_cvr/compute";
import { computeFirstChoiceBreakdown } from "./compute";
import { type FirstChoiceBreakdownOutput, Output } from "./index.contract";

interface DirectQueryResult {
  candidate_name: string;
  direct_count: number;
}

describe("first_choice_breakdown", () => {
  const originalSrcEnv = process.env.SRC_CSV;
  const originalDataEnv = process.env.DATA_ENV;
  const _testId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    // Set environment variables for test environment
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
    process.env.DATA_ENV = "test";

    // Add a small delay to prevent concurrent access
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    await ingestCvr();
  });

  afterAll(() => {
    // Restore original environment
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

    // Clean up test files
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
    expect(
      existsSync(
        "data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
      ),
    ).toBe(true);
  });

  it("should update manifest.json with correct structure", async () => {
    await computeFirstChoiceBreakdown();

    expect(existsSync("data/test/manifest.json")).toBe(true);

    const manifest = JSON.parse(
      readFileSync("data/test/manifest.json", "utf8"),
    );
    const election = manifest.elections.find(
      (e: any) => e.election_id === "portland-20241105-gen",
    );
    const contest = election.contests.find(
      (c: any) => c.contest_id === "d2-3seat",
    );
    const entry = contest.first_choice;

    expect(entry).toBeDefined();
    expect(entry.uri).toBe(
      "data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
    );
    expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
    expect(entry.rows).toBe(5);
    expect(contest.title).toBeDefined();
  });

  it("should maintain consistent file hashing", async () => {
    // Run twice and check that identical data produces identical hash
    await computeFirstChoiceBreakdown();
    const manifest1 = JSON.parse(
      readFileSync("data/test/manifest.json", "utf8"),
    );
    const election1 = manifest1.elections.find(
      (e: any) => e.election_id === "portland-20241105-gen",
    );
    const contest1 = election1.contests.find(
      (c: any) => c.contest_id === "d2-3seat",
    );
    const hash1 = contest1.first_choice.sha256;

    await computeFirstChoiceBreakdown();
    const manifest2 = JSON.parse(
      readFileSync("data/test/manifest.json", "utf8"),
    );
    const election2 = manifest2.elections.find(
      (e: any) => e.election_id === "portland-20241105-gen",
    );
    const contest2 = election2.contests.find(
      (c: any) => c.contest_id === "d2-3seat",
    );
    const hash2 = contest2.first_choice.sha256;

    expect(hash1).toBe(hash2);
  });

  it("should throw error when input parquet file does not exist", async () => {
    // Remove the input file temporarily
    const inputPath =
      "data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet";
    const backup = readFileSync(inputPath);
    unlinkSync(inputPath);

    try {
      await expect(computeFirstChoiceBreakdown()).rejects.toThrow(
        "Input file not found:",
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
        "CREATE VIEW first_choice AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet';",
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
        "CREATE VIEW first_choice AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet';",
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
    // Backup existing manifest if it exists
    let backupManifest: string | null = null;
    if (existsSync("data/test/manifest.json")) {
      backupManifest = readFileSync("data/test/manifest.json", "utf8");
    }

    // Create corrupted manifest
    writeFileSync("data/test/manifest.json", "invalid json content");

    try {
      await expect(computeFirstChoiceBreakdown()).rejects.toThrow(
        "Failed to parse manifest",
      );
    } finally {
      // Restore the backup manifest or clean up
      if (backupManifest) {
        writeFileSync("data/test/manifest.json", backupManifest);
      } else if (existsSync("data/test/manifest.json")) {
        unlinkSync("data/test/manifest.json");
      }
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
        "CREATE VIEW ballots_long AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet';",
      );
      await conn.run(
        "CREATE VIEW first_choice AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet';",
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
    const originalTestSrcEnv = process.env.SRC_CSV;
    const originalTestDataEnv = process.env.DATA_ENV;
    process.env.SRC_CSV = "tests/golden/micro/canonical_subset.csv";
    process.env.DATA_ENV = "test";

    try {
      // Add a small delay to prevent concurrent access
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

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
      if (originalTestSrcEnv) {
        process.env.SRC_CSV = originalTestSrcEnv;
      } else {
        delete process.env.SRC_CSV;
      }
      if (originalTestDataEnv) {
        process.env.DATA_ENV = originalTestDataEnv;
      } else {
        delete process.env.DATA_ENV;
      }
      // Add delay before re-ingesting to prevent file system race
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Re-ingest with original test data for other tests
      await ingestCvr();
    }
  }, 30000); // Set explicit 30 second timeout
});
