import { existsSync, readFileSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import type { Manifest } from "@/contracts/manifest";
import { assertTableColumns, parseAllRows } from "@/lib/contract-enforcer";
import {
  createStvMetaOutputFixture,
  createStvRoundsOutputFixture,
  StvMetaOutput,
  StvRoundsOutput,
} from "./index.contract";

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

      // All rows should conform to schemas - validate using fixture parsing
      roundsRows.forEach((row) => {
        const validatedRow = StvRoundsOutput.parse(row); // This will throw if invalid
        expect(validatedRow.candidate_name).toBe(row.candidate_name);
        expect(validatedRow.votes).toBe(row.votes);
        expect(validatedRow.round).toBe(row.round);
        expect(validatedRow.status).toBe(row.status);
      });

      metaRows.forEach((row) => {
        const validatedRow = StvMetaOutput.parse(row); // This will throw if invalid
        expect(validatedRow.quota).toBe(row.quota);
        expect(validatedRow.exhausted).toBe(row.exhausted);
        expect(validatedRow.round).toBe(row.round);
      });
    } finally {
      await conn.closeSync();
    }
  });

  it("should create valid v2 manifest structure", async () => {
    const manifestPath = "data/test/manifest.json";
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    const testFixture = createStvRoundsOutputFixture();

    // Verify v2 manifest structure using fixture data
    expect(manifest.version).toBe(2);
    expect(manifest.elections).toBeInstanceOf(Array);
    expect(manifest.elections.length).toBeGreaterThan(0);

    const election = manifest.elections.find(
      (e) => e.election_id === testFixture.election_id,
    );
    expect(election).toBeDefined();

    const contest = election?.contests.find(
      (c) => c.contest_id === testFixture.contest_id,
    );
    expect(contest).toBeDefined();
    expect(contest?.stv).toBeDefined();
    expect(contest?.stv.rounds).toBeDefined();
    expect(contest?.stv.meta).toBeDefined();
  });

  it("should validate fixture-generated test data", () => {
    // Test that our fixture generators produce valid schema-compliant data
    const roundsFixture = createStvRoundsOutputFixture({
      candidate_name: "Test Candidate",
      votes: 150.75,
      status: "elected",
    });

    const metaFixture = createStvMetaOutputFixture({
      quota: 200.0,
      exhausted: 5.25,
      elected_this_round: ["Test Candidate"],
    });

    // Should not throw
    const validatedRounds = StvRoundsOutput.parse(roundsFixture);
    const validatedMeta = StvMetaOutput.parse(metaFixture);

    expect(validatedRounds.candidate_name).toBe("Test Candidate");
    expect(validatedRounds.status).toBe("elected");
    expect(validatedMeta.quota).toBe(200.0);
    expect(validatedMeta.elected_this_round).toEqual(["Test Candidate"]);
  });
});
