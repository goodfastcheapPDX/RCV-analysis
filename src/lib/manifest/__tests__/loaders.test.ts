import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as duck from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Manifest } from "@/contracts/manifest";
import { ContestResolver } from "../contest-resolver";
import { loadFirstChoiceForContest, loadStvForContest } from "../loaders";

describe("loaders", () => {
  let testDir: string;
  let testManifest: Manifest;
  let resolver: ContestResolver;
  let db: duck.DuckDBInstance;
  let conn: duck.DuckDBConnection;

  // Use valid ID patterns that match the schema requirements
  const electionId = "portland-20241105-gen";
  const contestId = "d1-1seat";
  const districtId = "d1";

  beforeAll(async () => {
    // Create temporary directory for test data
    testDir = await mkdtemp(join(tmpdir(), "loaders-test-"));

    // Setup test database and connection
    db = await duck.DuckDBInstance.create();
    conn = await db.connect();

    // Create test first choice data (note: schema expects first_choice_votes and pct, not votes and percentage)
    const firstChoiceData = [
      {
        election_id: electionId,
        contest_id: contestId,
        district_id: districtId,
        seat_count: 1,
        candidate_name: "Alice",
        first_choice_votes: 100,
        pct: 40.0,
      },
      {
        election_id: electionId,
        contest_id: contestId,
        district_id: districtId,
        seat_count: 1,
        candidate_name: "Bob",
        first_choice_votes: 150,
        pct: 60.0,
      },
    ];

    // Create test STV rounds data
    const stvRoundsData = [
      {
        election_id: electionId,
        contest_id: contestId,
        district_id: districtId,
        seat_count: 1,
        round: 1,
        candidate_name: "Alice",
        votes: 100.0,
        status: "standing",
      },
      {
        election_id: electionId,
        contest_id: contestId,
        district_id: districtId,
        seat_count: 1,
        round: 2,
        candidate_name: "Alice",
        votes: 120.0,
        status: "elected",
      },
    ];

    // Create test STV meta data
    const stvMetaData = [
      {
        election_id: electionId,
        contest_id: contestId,
        district_id: districtId,
        seat_count: 1,
        round: 1,
        quota: 134.0,
        exhausted: 0.0,
        elected_this_round: null,
        eliminated_this_round: null,
      },
    ];

    // Create temporary tables and export to parquet
    await conn.run(`CREATE TEMP TABLE first_choice_temp AS SELECT 
      '${electionId}' as election_id,
      '${contestId}' as contest_id,
      '${districtId}' as district_id,
      ${firstChoiceData[0].seat_count} as seat_count,
      'Alice' as candidate_name,
      100 as first_choice_votes,
      CAST(40.0 AS DOUBLE) as pct
      UNION ALL SELECT
      '${electionId}' as election_id,
      '${contestId}' as contest_id,
      '${districtId}' as district_id,
      ${firstChoiceData[1].seat_count} as seat_count,
      'Bob' as candidate_name,
      150 as first_choice_votes,
      CAST(60.0 AS DOUBLE) as pct`);

    await conn.run(`CREATE TEMP TABLE stv_rounds_temp AS SELECT
      '${electionId}' as election_id,
      '${contestId}' as contest_id,
      '${districtId}' as district_id,
      ${stvRoundsData[0].seat_count} as seat_count,
      1 as round,
      'Alice' as candidate_name,
      CAST(100.0 AS DOUBLE) as votes,
      'standing' as status
      UNION ALL SELECT
      '${electionId}' as election_id,
      '${contestId}' as contest_id,
      '${districtId}' as district_id,
      ${stvRoundsData[1].seat_count} as seat_count,
      2 as round,
      'Alice' as candidate_name,
      CAST(120.0 AS DOUBLE) as votes,
      'elected' as status`);

    await conn.run(`CREATE TEMP TABLE stv_meta_temp AS SELECT
      '${electionId}' as election_id,
      '${contestId}' as contest_id,
      '${districtId}' as district_id,
      ${stvMetaData[0].seat_count} as seat_count,
      1 as round,
      CAST(134.0 AS DOUBLE) as quota,
      CAST(0.0 AS DOUBLE) as exhausted,
      NULL as elected_this_round,
      NULL as eliminated_this_round`);

    const firstChoicePath = join(testDir, "first_choice.parquet");
    const stvRoundsPath = join(testDir, "stv_rounds.parquet");
    const stvMetaPath = join(testDir, "stv_meta.parquet");

    await conn.run(
      `COPY first_choice_temp TO '${firstChoicePath}' (FORMAT 'parquet')`,
    );
    await conn.run(
      `COPY stv_rounds_temp TO '${stvRoundsPath}' (FORMAT 'parquet')`,
    );
    await conn.run(`COPY stv_meta_temp TO '${stvMetaPath}' (FORMAT 'parquet')`);

    // Create test manifest
    testManifest = {
      env: "test",
      version: 2,
      inputs: {},
      elections: [
        {
          election_id: electionId,
          date: "2024-11-05",
          jurisdiction: "portland",
          title: "Test Election",
          contests: [
            {
              contest_id: contestId,
              district_id: districtId,
              seat_count: 1,
              title: "Test Contest",
              cvr: {
                candidates: {
                  uri: "test-candidates.parquet",
                  sha256: "abc123",
                  rows: 2,
                },
                ballots_long: {
                  uri: "test-ballots.parquet",
                  sha256: "def456",
                  rows: 250,
                },
              },
              stv: {
                rounds: {
                  uri: stvRoundsPath,
                  sha256: "ghi789",
                  rows: 2,
                },
                meta: {
                  uri: stvMetaPath,
                  sha256: "jkl012",
                  rows: 1,
                },
              },
              first_choice: {
                uri: firstChoicePath,
                sha256: "mno345",
                rows: 2,
              },
              rules: {
                method: "meek",
                quota: "droop",
                precision: 0.000001,
                tie_break: "lexicographic",
                seats: 1,
              },
            },
          ],
        },
      ],
    };

    resolver = new ContestResolver(testManifest);
  });

  afterAll(async () => {
    await conn.closeSync();
    await rm(testDir, { recursive: true, force: true });
  });

  describe("loadFirstChoiceForContest", () => {
    it("should load and validate first choice data successfully", async () => {
      const result = await loadFirstChoiceForContest(
        electionId,
        contestId,
        undefined,
        resolver,
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        candidate_name: "Alice",
        first_choice_votes: 100,
        pct: 40.0,
      });
      expect(result.contest.contest_id).toBe(contestId);
      expect(result.election.election_id).toBe(electionId);
    });

    it("should throw error when contest not found", async () => {
      await expect(
        loadFirstChoiceForContest(electionId, "d99-1seat", undefined, resolver),
      ).rejects.toThrow(`Contest ${electionId}/d99-1seat not found`);
    });
  });

  describe("loadStvForContest", () => {
    it("should load and validate STV data successfully", async () => {
      const result = await loadStvForContest(
        electionId,
        contestId,
        undefined,
        resolver,
      );

      expect(result.roundsData).toHaveLength(2);
      expect(result.metaData).toHaveLength(1);
      expect(result.roundsData[0]).toMatchObject({
        candidate_name: "Alice",
        round: 1,
        votes: 100.0,
        status: "standing",
      });
      expect(result.stats).toMatchObject({
        number_of_rounds: 2,
        winners: ["Alice"],
        seats: 1,
        first_round_quota: 134.0,
        precision: 0.000001,
      });
      expect(result.contest.contest_id).toBe(contestId);
      expect(result.election.election_id).toBe(electionId);
    });

    it("should handle missing meta data gracefully", async () => {
      // Create a contest without meta data
      const noMetaManifest = {
        ...testManifest,
        elections: [
          {
            ...testManifest.elections[0],
            contests: [
              {
                ...testManifest.elections[0].contests[0],
                stv: {
                  rounds: testManifest.elections[0].contests[0].stv.rounds!,
                  // No meta data
                },
              },
            ],
          },
        ],
      };

      const noMetaResolver = new ContestResolver(noMetaManifest);
      const result = await loadStvForContest(
        electionId,
        contestId,
        undefined,
        noMetaResolver,
      );

      expect(result.metaData).toHaveLength(0);
      expect(result.stats.first_round_quota).toBe(0);
    });

    it("should throw error when contest not found", async () => {
      await expect(
        loadStvForContest(electionId, "d99-1seat", undefined, resolver),
      ).rejects.toThrow(`Contest ${electionId}/d99-1seat not found`);
    });
  });
});
