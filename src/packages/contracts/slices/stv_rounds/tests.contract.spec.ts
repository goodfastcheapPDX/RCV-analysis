import { existsSync, unlinkSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertTableColumns,
  parseAllRows,
} from "../../lib/contract-enforcer.js";
import { ingestCvr } from "../ingest_cvr/compute";
import { computeStvRounds } from "./compute";
import {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "./index.contract";

describe("STV Rounds Contract Tests", () => {
  const originalSrcEnv = process.env.SRC_CSV;
  const originalDataEnv = process.env.DATA_ENV;

  beforeAll(async () => {
    // Set up test data
    process.env.SRC_CSV = "tests/golden/micro/cvr_small.csv";
    process.env.DATA_ENV = "test";
    await ingestCvr();
  });

  afterAll(() => {
    // Clean up
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

    const testFiles = [
      "data/test/portland-20241105-gen/d2-3seat/ingest/candidates.parquet",
      "data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet",
      "data/test/portland-20241105-gen/d2-3seat/stv/rounds.parquet",
      "data/test/portland-20241105-gen/d2-3seat/stv/meta.parquet",
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

  it("should enforce contract validation during compute", async () => {
    const result = await computeStvRounds();

    // Verify return value matches contract
    expect(result).toMatchObject({
      number_of_rounds: expect.any(Number),
      winners: expect.any(Array),
      seats: expect.any(Number),
      first_round_quota: expect.any(Number),
      precision: expect.any(Number),
    });

    // Validate result with contract
    expect(() => StvRoundsStats.parse(result)).not.toThrow();
  });

  it("should enforce table columns match schemas", async () => {
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        "CREATE VIEW stv_rounds AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/stv/rounds.parquet';",
      );
      await conn.run(
        "CREATE VIEW stv_meta AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/stv/meta.parquet';",
      );

      // This should pass without throwing
      await assertTableColumns(conn, "stv_rounds", StvRoundsOutput);
      await assertTableColumns(conn, "stv_meta", StvMetaOutput);
    } finally {
      await conn.closeSync();
    }
  });

  it("should validate all rows through schemas", async () => {
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      await conn.run(
        "CREATE VIEW stv_rounds AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/stv/rounds.parquet';",
      );
      await conn.run(
        "CREATE VIEW stv_meta AS SELECT * FROM 'data/test/portland-20241105-gen/d2-3seat/stv/meta.parquet';",
      );

      // This should return validated rows
      const roundsRows = await parseAllRows(
        conn,
        "stv_rounds",
        StvRoundsOutput,
      );
      const metaRows = await parseAllRows(conn, "stv_meta", StvMetaOutput);

      expect(roundsRows.length).toBeGreaterThan(0);
      expect(metaRows.length).toBeGreaterThan(0);

      // All rows should conform to schemas
      roundsRows.forEach((row) => {
        expect(typeof row.candidate_name).toBe("string");
        expect(row.candidate_name.length).toBeGreaterThan(0);
        expect(typeof row.votes).toBe("number");
        expect(row.votes).toBeGreaterThanOrEqual(0);
        expect(typeof row.round).toBe("number");
        expect(row.round).toBeGreaterThan(0);
        expect(["standing", "elected", "eliminated"]).toContain(row.status);
      });

      metaRows.forEach((row) => {
        expect(typeof row.quota).toBe("number");
        expect(row.quota).toBeGreaterThan(0);
        expect(typeof row.exhausted).toBe("number");
        expect(row.exhausted).toBeGreaterThanOrEqual(0);
        expect(typeof row.round).toBe("number");
        expect(row.round).toBeGreaterThan(0);
      });
    } finally {
      await conn.closeSync();
    }
  });

  it("should create valid v2 manifest structure", async () => {
    const manifestPath = "data/test/manifest.json";
    expect(existsSync(manifestPath)).toBe(true);

    const fs = await import("node:fs");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Verify v2 manifest structure
    expect(manifest.version).toBe(2);
    expect(manifest.elections).toBeInstanceOf(Array);
    expect(manifest.elections.length).toBeGreaterThan(0);

    const election = manifest.elections.find(
      (e: any) => e.election_id === "portland-20241105-gen",
    );
    expect(election).toBeDefined();

    const contest = election.contests.find(
      (c: any) => c.contest_id === "d2-3seat",
    );
    expect(contest).toBeDefined();
    expect(contest.stv).toBeDefined();
    expect(contest.stv.rounds).toBeDefined();
    expect(contest.stv.meta).toBeDefined();
  });
});
