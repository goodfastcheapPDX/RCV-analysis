import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import {
  assertTableColumns,
  parseAllRows,
} from "../../lib/contract-enforcer.js";
import { StvMetaOutput, StvRoundsOutput } from "./index.contract";

describe("STV Rounds Contract Tests", () => {
  // Tests rely on global test setup for data

  it("should have generated STV data files", async () => {
    const roundsPath =
      "data/test/portland-20241105-gen/d2-3seat/stv/rounds.parquet";
    const metaPath =
      "data/test/portland-20241105-gen/d2-3seat/stv/meta.parquet";

    expect(existsSync(roundsPath)).toBe(true);
    expect(existsSync(metaPath)).toBe(true);
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
