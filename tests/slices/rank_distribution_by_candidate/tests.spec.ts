import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, test } from "vitest";
import { Manifest } from "@/contracts/manifest";
import { computeRankDistributionByCandidate } from "@/packages/contracts/slices/rank_distribution_by_candidate/compute";
import {
  Data,
  Output,
  Stats,
} from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";

describe("Rank Distribution by Candidate Integration", () => {
  test("computes rank distribution correctly using test data", async () => {
    const electionId = "portland-20241105-gen";
    const contestId = "d2-3seat";
    const env = "test";

    const result = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    // Verify stats structure
    expect(result.stats).toEqual({
      max_rank: expect.any(Number),
      total_ballots: expect.any(Number),
      candidate_count: expect.any(Number),
      zero_rank_candidates: expect.any(Number),
    });

    // Verify data structure
    expect(result.data).toEqual({
      rows: expect.any(Number),
    });

    // Verify stats make sense for our golden test dataset
    expect(result.stats.max_rank).toBe(3);
    expect(result.stats.candidate_count).toBe(5);
    expect(result.stats.total_ballots).toBeGreaterThan(0);
    expect(result.stats.zero_rank_candidates).toBeGreaterThanOrEqual(0);

    // Verify dense grid: rows = candidates × ranks
    expect(result.data.rows).toBe(
      result.stats.candidate_count * result.stats.max_rank,
    );
  });

  test("produces valid parquet artifact", async () => {
    const electionId = "portland-20241105-gen";
    const contestId = "d2-3seat";
    const env = "test";

    await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    // Verify parquet file was created
    const parquetPath = join(
      "data",
      env,
      electionId,
      contestId,
      "rank_distribution",
      "rank_distribution.parquet",
    );

    // Read and validate parquet data
    const db = await DuckDBInstance.create();
    const conn = await db.connect();
    await conn.run(`CREATE VIEW rank_data AS SELECT * FROM '${parquetPath}';`);

    // Check structure
    const result = await conn.run("PRAGMA table_info('rank_data')");
    const columns = await result.getRowObjects();
    const columnNames = columns.map((col) => col.name);

    expect(columnNames).toContain("election_id");
    expect(columnNames).toContain("contest_id");
    expect(columnNames).toContain("candidate_id");
    expect(columnNames).toContain("rank_position");
    expect(columnNames).toContain("count");
    expect(columnNames).toContain("pct_all_ballots");
    expect(columnNames).toContain("pct_among_rankers");

    // Check data validity
    const dataResult = await conn.run("SELECT * FROM rank_data LIMIT 10");
    const rows = await dataResult.getRowObjects();

    expect(rows.length).toBeGreaterThan(0);

    // Validate a sample row structure
    const firstRow = rows[0];
    expect(firstRow).toHaveProperty("election_id", electionId);
    expect(firstRow).toHaveProperty("contest_id", contestId);
    expect(
      typeof firstRow.candidate_id === "number" ||
        typeof firstRow.candidate_id === "bigint",
    ).toBe(true);
    expect(
      typeof firstRow.rank_position === "number" ||
        typeof firstRow.rank_position === "bigint",
    ).toBe(true);
    expect(
      typeof firstRow.count === "number" || typeof firstRow.count === "bigint",
    ).toBe(true);
    expect(typeof firstRow.pct_all_ballots).toBe("number");
    expect(typeof firstRow.pct_among_rankers).toBe("number");
  });

  test("updates manifest correctly", async () => {
    const electionId = "portland-20241105-gen";
    const contestId = "d2-3seat";
    const env = "test";

    await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    // Check manifest was updated
    const manifestPath = `data/${env}/manifest.json`;
    const manifest = Manifest.parse(
      JSON.parse(readFileSync(manifestPath, "utf8")),
    );

    // Find the correct contest in the nested structure
    const election = manifest.elections.find(
      (e) => e.election_id === electionId,
    );
    expect(election).toBeDefined();

    const contest = election?.contests.find((c) => c.contest_id === contestId);
    expect(contest).toBeDefined();

    // Check that rank_distribution artifact was added to the contest
    expect(contest?.rank_distribution).toBeDefined();
    expect(contest?.rank_distribution).toEqual({
      uri: expect.stringContaining("rank_distribution.parquet"),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      rows: expect.any(Number),
    });
  });

  test("handles edge cases correctly", async () => {
    // This test would require creating specific edge case data,
    // but for now we'll test that the function handles the golden dataset
    // which includes some edge cases like zero-rank candidates

    const electionId = "portland-20241105-gen";
    const contestId = "d2-3seat";
    const env = "test";

    const result = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    // Test invariants hold
    expect(result.stats.max_rank).toBeGreaterThan(0);
    expect(result.stats.candidate_count).toBeGreaterThan(0);
    expect(result.stats.total_ballots).toBeGreaterThan(0);
    expect(result.stats.zero_rank_candidates).toBeGreaterThanOrEqual(0);
    expect(result.stats.zero_rank_candidates).toBeLessThanOrEqual(
      result.stats.candidate_count,
    );

    expect(result.data.rows).toBe(
      result.stats.candidate_count * result.stats.max_rank,
    );
  });

  test("performance constraints are met", async () => {
    const electionId = "portland-20241105-gen";
    const contestId = "d2-3seat";
    const env = "test";

    const startTime = Date.now();

    const _result = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    const duration = Date.now() - startTime;

    // Should complete in under 60 seconds as per task requirements
    expect(duration).toBeLessThan(60000);

    // Check artifact size (should be under 50MB as per task requirements)
    const parquetPath = join(
      "data",
      env,
      electionId,
      contestId,
      "rank_distribution",
      "rank_distribution.parquet",
    );

    const stats = require("node:fs").statSync(parquetPath);
    expect(stats.size).toBeLessThan(50 * 1024 * 1024); // 50MB in bytes
  });
});
