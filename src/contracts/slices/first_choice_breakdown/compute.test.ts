import { existsSync, readFileSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import type { Manifest } from "@/contracts/manifest";
import { assertTableColumns, parseAllRows } from "@/lib/contract-enforcer";
import { computeFirstChoiceBreakdown } from "./compute";
import {
  createFirstChoiceBreakdownOutputFixture,
  createOutputFixture,
  Output,
} from "./index.contract";

describe("computeFirstChoiceBreakdown", () => {
  // Use the global test data that's already set up by the test environment
  const testElectionId = "portland-20241105-gen";
  const testContestId = "d2-3seat";
  const testDistrictId = "d2";
  const testSeatCount = 3;

  describe("successful computation", () => {
    it("should compute first choice breakdown with correct data", async () => {
      const result = await computeFirstChoiceBreakdown({
        electionId: testElectionId,
        contestId: testContestId,
        districtId: testDistrictId,
        seatCount: testSeatCount,
      });

      // Validate return structure matches contract
      expect(result).toMatchObject({
        stats: {
          total_valid_ballots: expect.any(Number),
          candidate_count: expect.any(Number),
          sum_first_choice: expect.any(Number),
        },
        data: {
          rows: expect.any(Number),
        },
      });

      // Validate stats are reasonable
      expect(result.stats.total_valid_ballots).toBeGreaterThan(0);
      expect(result.stats.candidate_count).toBeGreaterThan(0);
      expect(result.stats.sum_first_choice).toBe(
        result.stats.total_valid_ballots,
      );
      expect(result.data.rows).toBe(result.stats.candidate_count);
    });

    it("should create parquet file with correct structure", async () => {
      await computeFirstChoiceBreakdown({
        electionId: testElectionId,
        contestId: testContestId,
        districtId: testDistrictId,
        seatCount: testSeatCount,
      });

      const parquetPath = `data/test/${testElectionId}/${testContestId}/first_choice/first_choice.parquet`;
      expect(existsSync(parquetPath)).toBe(true);

      // Verify parquet structure matches Output schema
      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        await conn.run(
          `CREATE VIEW test_output AS SELECT * FROM '${parquetPath}'`,
        );
        await assertTableColumns(conn, "test_output", Output);

        const rows = await parseAllRows(conn, "test_output", Output);
        expect(rows.length).toBeGreaterThan(0);

        // Verify identity columns are set correctly
        rows.forEach((row) => {
          expect(row.election_id).toBe(testElectionId);
          expect(row.contest_id).toBe(testContestId);
          expect(row.district_id).toBe(testDistrictId);
          expect(row.seat_count).toBe(testSeatCount);
        });
      } finally {
        await conn.closeSync();
      }
    });

    it("should update manifest with correct artifact information", async () => {
      await computeFirstChoiceBreakdown({
        electionId: testElectionId,
        contestId: testContestId,
        districtId: testDistrictId,
        seatCount: testSeatCount,
      });

      const manifestPath = "data/test/manifest.json";
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf8"),
      ) as Manifest;
      const contest = manifest.elections
        .find((e) => e.election_id === testElectionId)
        ?.contests.find((c) => c.contest_id === testContestId);

      expect(contest?.first_choice).toBeDefined();
      expect(contest?.first_choice?.uri).toMatch(/first_choice\.parquet$/);
      expect(contest?.first_choice?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(contest?.first_choice?.rows).toBeGreaterThan(0);
    });

    it("should calculate percentages correctly", async () => {
      await computeFirstChoiceBreakdown({
        electionId: testElectionId,
        contestId: testContestId,
        districtId: testDistrictId,
        seatCount: testSeatCount,
      });

      const instance = await DuckDBInstance.create();
      const conn = await instance.connect();

      try {
        await conn.run(`
          CREATE VIEW test_output AS 
          SELECT * FROM 'data/test/${testElectionId}/${testContestId}/first_choice/first_choice.parquet'
          ORDER BY first_choice_votes DESC, candidate_name ASC
        `);

        const rows = await parseAllRows(conn, "test_output", Output);

        // Verify percentages are reasonable
        rows.forEach((row) => {
          expect(row.pct).toBeGreaterThanOrEqual(0);
          expect(row.pct).toBeLessThanOrEqual(100);
          expect(row.first_choice_votes).toBeGreaterThanOrEqual(0);
        });

        // Total percentage should sum to ~100
        const totalPct = rows.reduce((sum, row) => sum + row.pct, 0);
        expect(Math.abs(totalPct - 100)).toBeLessThan(0.01);
      } finally {
        await conn.closeSync();
      }
    });
  });

  describe("contract enforcement", () => {
    it("should validate all data through contract enforcement", async () => {
      // This test ensures the function calls assertTableColumns and parseAllRows
      const result = await computeFirstChoiceBreakdown({
        electionId: testElectionId,
        contestId: testContestId,
        districtId: testDistrictId,
        seatCount: testSeatCount,
      });

      // If we get here, contract enforcement passed
      expect(result.stats.candidate_count).toBeGreaterThan(0);
      expect(result.data.rows).toBeGreaterThan(0);
    });

    it("should derive stats from validated data", async () => {
      const result = await computeFirstChoiceBreakdown({
        electionId: testElectionId,
        contestId: testContestId,
        districtId: testDistrictId,
        seatCount: testSeatCount,
      });

      // Stats should be consistent with each other
      expect(result.stats.total_valid_ballots).toBe(
        result.stats.sum_first_choice,
      );
      expect(result.stats.candidate_count).toBe(result.data.rows);
    });
  });

  describe("integration with fixtures", () => {
    it("should work with createOutputFixture", () => {
      const fixture = createOutputFixture({
        election_id: testElectionId,
        contest_id: testContestId,
        district_id: testDistrictId,
        candidate_name: "Test Candidate",
        first_choice_votes: 5,
        pct: 50.0,
      });

      expect(fixture.election_id).toBe(testElectionId);
      expect(fixture.contest_id).toBe(testContestId);
      expect(fixture.district_id).toBe(testDistrictId);
      expect(fixture.candidate_name).toBe("Test Candidate");
      expect(fixture.first_choice_votes).toBe(5);
      expect(fixture.pct).toBe(50.0);
    });

    it("should work with createFirstChoiceBreakdownOutputFixture", () => {
      const fixture = createFirstChoiceBreakdownOutputFixture({
        stats: {
          total_valid_ballots: 10,
          candidate_count: 3,
          sum_first_choice: 10,
        },
        data: { rows: 3 },
      });

      expect(fixture.stats.total_valid_ballots).toBe(10);
      expect(fixture.stats.candidate_count).toBe(3);
      expect(fixture.data.rows).toBe(3);
    });
  });
});
