import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, test } from "vitest";
import {
  assertTableColumns,
  parseAllRows,
} from "@/packages/contracts/lib/contract-enforcer";
import {
  createDataFixture,
  createOutputFixture,
  createStatsFixture,
  Data,
  Output,
  SQL_QUERIES,
  Stats,
} from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";

describe("Rank Distribution by Candidate Contract", () => {
  test("Output schema validates correctly", () => {
    const validOutput = createOutputFixture();
    expect(() => Output.parse(validOutput)).not.toThrow();
  });

  test("Output schema rejects invalid data", () => {
    expect(() =>
      Output.parse(createOutputFixture({ candidate_id: -1 })),
    ).toThrow();
    expect(() =>
      Output.parse(createOutputFixture({ rank_position: 0 })),
    ).toThrow();
    expect(() => Output.parse(createOutputFixture({ count: -1 }))).toThrow();
    expect(() =>
      Output.parse(createOutputFixture({ pct_all_ballots: 1.5 })),
    ).toThrow();
    expect(() =>
      Output.parse(createOutputFixture({ pct_among_rankers: -0.1 })),
    ).toThrow();
  });

  test("Stats schema validates correctly", () => {
    const validStats = createStatsFixture();
    expect(() => Stats.parse(validStats)).not.toThrow();
  });

  test("Stats schema rejects invalid data", () => {
    expect(() => Stats.parse(createStatsFixture({ max_rank: 0 }))).toThrow();
    expect(() =>
      Stats.parse(createStatsFixture({ total_ballots: -1 })),
    ).toThrow();
    expect(() =>
      Stats.parse(createStatsFixture({ candidate_count: 0 })),
    ).toThrow();
    expect(() =>
      Stats.parse(createStatsFixture({ zero_rank_candidates: -1 })),
    ).toThrow();
  });

  test("Data schema validates correctly", () => {
    const validData = createDataFixture();
    expect(() => Data.parse(validData)).not.toThrow();
  });
});

describe("SQL Integration Tests", () => {
  test("Golden dataset produces expected rank distribution", async () => {
    const db = await DuckDBInstance.create();
    const conn = await db.connect();

    try {
      // Create test data that mirrors the golden micro dataset structure
      await conn.run(`
        CREATE TABLE ballots_long (
          election_id VARCHAR,
          contest_id VARCHAR,
          BallotID VARCHAR,
          candidate_id INTEGER,
          candidate_name VARCHAR,
          rank_position INTEGER,
          has_vote BOOLEAN
        );
      `);

      // Insert golden test data with known patterns:
      // - 3 candidates: Alice(1), Bob(2), Charlie(3)
      // - 6 ballots total
      // - max_rank = 3
      // - Include one candidate (Charlie) that's never ranked (zero-rank case)
      // - Include gaps in rankings (ballot skips rank 2)
      await conn.run(`
        INSERT INTO ballots_long VALUES
        -- Ballot 1: Alice(1), Bob(2) - skip rank 3
        ('test-election', 'test-contest', 'ballot-1', 1, 'Alice', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-1', 2, 'Bob', 2, TRUE),
        ('test-election', 'test-contest', 'ballot-1', 3, 'Charlie', 3, FALSE),
        
        -- Ballot 2: Bob(1), Alice(2) 
        ('test-election', 'test-contest', 'ballot-2', 1, 'Alice', 2, TRUE),
        ('test-election', 'test-contest', 'ballot-2', 2, 'Bob', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-2', 3, 'Charlie', 3, FALSE),
        
        -- Ballot 3: Alice(1) only
        ('test-election', 'test-contest', 'ballot-3', 1, 'Alice', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-3', 2, 'Bob', 2, FALSE),
        ('test-election', 'test-contest', 'ballot-3', 3, 'Charlie', 3, FALSE),
        
        -- Ballot 4: Bob(1), Alice(3) - skip rank 2
        ('test-election', 'test-contest', 'ballot-4', 1, 'Alice', 3, TRUE),
        ('test-election', 'test-contest', 'ballot-4', 2, 'Bob', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-4', 3, 'Charlie', 2, FALSE),
        
        -- Ballot 5: Alice(1), Bob(2), Charlie never ranked
        ('test-election', 'test-contest', 'ballot-5', 1, 'Alice', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-5', 2, 'Bob', 2, TRUE),
        ('test-election', 'test-contest', 'ballot-5', 3, 'Charlie', 3, FALSE),
        
        -- Ballot 6: Bob(1) only  
        ('test-election', 'test-contest', 'ballot-6', 1, 'Alice', 2, FALSE),
        ('test-election', 'test-contest', 'ballot-6', 2, 'Bob', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-6', 3, 'Charlie', 3, FALSE);
      `);

      // Run rank distribution computation
      await conn.run(SQL_QUERIES.exportRankDistribution);

      // Add identity columns for contract validation with valid patterns
      await conn.run(`
        CREATE OR REPLACE TABLE rank_distribution_with_identity AS
        SELECT
          'portland-20241105-gen' AS election_id,
          'd2-3seat' AS contest_id,
          'd2' AS district_id,
          3 AS seat_count,
          candidate_id,
          rank_position,
          count,
          pct_all_ballots,
          pct_among_rankers
        FROM rank_distribution_tmp;
      `);

      // Validate schema
      await assertTableColumns(conn, "rank_distribution_with_identity", Output);

      // Parse and validate all rows
      const rows = await parseAllRows(
        conn,
        "rank_distribution_with_identity",
        Output,
      );

      // Expected results:
      // Total ballots with votes: 6
      // Alice: rank 1 = 3 ballots, rank 2 = 1 ballot, rank 3 = 1 ballot (total rankers: 5)
      // Bob: rank 1 = 3 ballots, rank 2 = 3 ballots, rank 3 = 0 ballots (total rankers: 6)
      // Charlie: rank 1 = 0, rank 2 = 0, rank 3 = 0 (total rankers: 0, zero-rank candidate)

      expect(rows).toHaveLength(9); // 3 candidates × 3 ranks

      // Check Alice's distribution
      const aliceRank1 = rows.find(
        (r) => r.candidate_id === 1 && r.rank_position === 1,
      );
      expect(aliceRank1).toEqual(
        expect.objectContaining({
          candidate_id: 1,
          rank_position: 1,
          count: 3,
          pct_all_ballots: 0.5, // 3/6
          pct_among_rankers: 0.6, // 3/5
        }),
      );

      const aliceRank2 = rows.find(
        (r) => r.candidate_id === 1 && r.rank_position === 2,
      );
      expect(aliceRank2).toEqual(
        expect.objectContaining({
          candidate_id: 1,
          rank_position: 2,
          count: 1,
          pct_all_ballots: 1 / 6,
          pct_among_rankers: 0.2, // 1/5
        }),
      );

      // Check Bob's distribution
      const bobRank1 = rows.find(
        (r) => r.candidate_id === 2 && r.rank_position === 1,
      );
      expect(bobRank1).toEqual(
        expect.objectContaining({
          candidate_id: 2,
          rank_position: 1,
          count: 3,
          pct_all_ballots: 0.5, // 3/6
          pct_among_rankers: 0.6, // 3/5 (since only 5 ballots ranked Bob)
        }),
      );

      // Check Charlie (zero-rank candidate)
      const charlieRank1 = rows.find(
        (r) => r.candidate_id === 3 && r.rank_position === 1,
      );
      expect(charlieRank1).toEqual(
        expect.objectContaining({
          candidate_id: 3,
          rank_position: 1,
          count: 0,
          pct_all_ballots: 0,
          pct_among_rankers: 0,
        }),
      );

      // Verify all Charlie rows are zero
      const charlieRows = rows.filter((r) => r.candidate_id === 3);
      expect(charlieRows).toHaveLength(3);
      charlieRows.forEach((row) => {
        expect(row.count).toBe(0);
        expect(row.pct_all_ballots).toBe(0);
        expect(row.pct_among_rankers).toBe(0);
      });
    } catch (error) {
      throw error;
    }
  });

  test("Invariant tests pass with golden data", async () => {
    const db = await DuckDBInstance.create();
    const conn = await db.connect();

    try {
      // Use same test data as above
      await conn.run(`
        CREATE TABLE ballots_long (
          election_id VARCHAR,
          contest_id VARCHAR, 
          BallotID VARCHAR,
          candidate_id INTEGER,
          candidate_name VARCHAR,
          rank_position INTEGER,
          has_vote BOOLEAN
        );
      `);

      await conn.run(`
        INSERT INTO ballots_long VALUES
        ('test-election', 'test-contest', 'ballot-1', 1, 'Alice', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-1', 2, 'Bob', 2, TRUE),
        ('test-election', 'test-contest', 'ballot-1', 3, 'Charlie', 3, FALSE),
        
        ('test-election', 'test-contest', 'ballot-2', 1, 'Alice', 2, TRUE),
        ('test-election', 'test-contest', 'ballot-2', 2, 'Bob', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-2', 3, 'Charlie', 3, FALSE),
        
        ('test-election', 'test-contest', 'ballot-3', 1, 'Alice', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-3', 2, 'Bob', 2, FALSE),
        ('test-election', 'test-contest', 'ballot-3', 3, 'Charlie', 3, FALSE),
        
        ('test-election', 'test-contest', 'ballot-4', 1, 'Alice', 3, TRUE),
        ('test-election', 'test-contest', 'ballot-4', 2, 'Bob', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-4', 3, 'Charlie', 2, FALSE),
        
        ('test-election', 'test-contest', 'ballot-5', 1, 'Alice', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-5', 2, 'Bob', 2, TRUE),
        ('test-election', 'test-contest', 'ballot-5', 3, 'Charlie', 3, FALSE),
        
        ('test-election', 'test-contest', 'ballot-6', 1, 'Alice', 2, FALSE),
        ('test-election', 'test-contest', 'ballot-6', 2, 'Bob', 1, TRUE),
        ('test-election', 'test-contest', 'ballot-6', 3, 'Charlie', 3, FALSE);
      `);

      await conn.run(SQL_QUERIES.exportRankDistribution);

      await conn.run(`
        CREATE OR REPLACE TABLE rank_distribution_with_identity AS
        SELECT
          'portland-20241105-gen' AS election_id,
          'd2-3seat' AS contest_id,
          'd2' AS district_id,
          3 AS seat_count,
          candidate_id,
          rank_position,
          count,
          pct_all_ballots,
          pct_among_rankers
        FROM rank_distribution_tmp;
      `);

      const rows = await parseAllRows(
        conn,
        "rank_distribution_with_identity",
        Output,
      );

      // Invariant 1: count >= 0, rank_position in [1, max_rank]
      rows.forEach((row) => {
        expect(row.count).toBeGreaterThanOrEqual(0);
        expect(row.rank_position).toBeGreaterThanOrEqual(1);
        expect(row.rank_position).toBeLessThanOrEqual(3); // max_rank = 3
      });

      // Invariant 2: For each candidate, sum(count over rank_position) == ballots_that_ranked_candidate
      const candidateIds = [...new Set(rows.map((r) => r.candidate_id))];
      candidateIds.forEach((candidateId) => {
        const candidateRows = rows.filter(
          (r) => r.candidate_id === candidateId,
        );
        const totalCount = candidateRows.reduce((sum, r) => sum + r.count, 0);

        if (candidateId === 1) expect(totalCount).toBe(5); // Alice: 5 ballots ranked her
        if (candidateId === 2) expect(totalCount).toBe(5); // Bob: 5 ballots ranked him
        if (candidateId === 3) expect(totalCount).toBe(0); // Charlie: 0 ballots ranked him
      });

      // Invariant 3: pct_all_ballots == count / total_ballots within tolerance
      const totalBallots = 6;
      rows.forEach((row) => {
        const expectedPctAllBallots = row.count / totalBallots;
        expect(row.pct_all_ballots).toBeCloseTo(expectedPctAllBallots, 10);
      });

      // Invariant 4: For any rank position, sum(count) <= total_ballots
      for (let rank = 1; rank <= 3; rank++) {
        const rankRows = rows.filter((r) => r.rank_position === rank);
        const totalAtRank = rankRows.reduce((sum, r) => sum + r.count, 0);
        expect(totalAtRank).toBeLessThanOrEqual(totalBallots);
      }

      // Invariant 5: Dense grid - each candidate appears for every rank 1..max_rank
      candidateIds.forEach((candidateId) => {
        for (let rank = 1; rank <= 3; rank++) {
          const row = rows.find(
            (r) => r.candidate_id === candidateId && r.rank_position === rank,
          );
          expect(row).toBeDefined();
        }
      });
    } catch (error) {
      throw error;
    }
  });
});
