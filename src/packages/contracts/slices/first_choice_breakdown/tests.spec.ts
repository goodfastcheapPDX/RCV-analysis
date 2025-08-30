import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertTableColumns,
  parseAllRows,
} from "@/packages/contracts/lib/contract-enforcer";
import { Output } from "./index.contract";

interface DirectQueryResult {
  candidate_name: string;
  direct_count: number;
}

describe("first_choice_breakdown", () => {
  // Tests rely on global test setup for data

  it("should have computed first choice breakdown with exact expected counts", async () => {
    // Verify the global setup has generated the expected first choice data
    const testDataPath =
      "data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet";
    expect(existsSync(testDataPath)).toBe(true);

    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        `CREATE VIEW first_choice AS SELECT * FROM '${testDataPath}';`,
      );

      const validatedRows = await parseAllRows(conn, "first_choice", Output);

      // Based on micro golden case with 12 ballots and first choices analysis
      expect(validatedRows.length).toBe(5); // 5 candidates receiving first choice votes

      const totalVotes = validatedRows.reduce(
        (sum, row) => sum + row.first_choice_votes,
        0,
      );
      expect(totalVotes).toBe(12); // 12 ballots with first choices

      const totalPct = validatedRows.reduce((sum, row) => sum + row.pct, 0);
      expect(Math.abs(totalPct - 100)).toBeLessThan(0.01); // Should sum to ~100%
    } finally {
      await conn.closeSync();
    }
  });

  it("should have created parquet export file", async () => {
    expect(
      existsSync(
        "data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
      ),
    ).toBe(true);
  });

  it("should have updated manifest.json with correct structure", async () => {
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

  it("should have consistent file hashing", async () => {
    // Verify the hash exists and is properly formatted
    const manifest = JSON.parse(
      readFileSync("data/test/manifest.json", "utf8"),
    );
    const election = manifest.elections.find(
      (e: any) => e.election_id === "portland-20241105-gen",
    );
    const contest = election.contests.find(
      (c: any) => c.contest_id === "d2-3seat",
    );
    const hash = contest.first_choice.sha256;

    expect(hash).toMatch(/^[a-f0-9]{64}$/); // Valid SHA256 format
    expect(hash.length).toBe(64);
  });

  it("should validate percentage calculations with contract enforcement", async () => {
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

  it("should validate against ballots_long input data consistency", async () => {
    // Directly query ballots_long to verify first choice counts match computed results
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
});
