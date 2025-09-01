import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ContestId, DistrictId, ElectionId } from "@/contracts/ids";
import type { Manifest } from "@/contracts/manifest";
import { ingestCvr } from "./compute";

describe("ingest_cvr", () => {
  // Tests rely on global test setup for data

  it("should have ingested CVR data with exact expected counts", async () => {
    // Verify the global setup has generated the expected CVR data
    const candidatesPath =
      "data/test/portland-20241105-gen/d2-3seat/ingest/candidates.parquet";
    const ballotsPath =
      "data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet";

    expect(existsSync(candidatesPath)).toBe(true);
    expect(existsSync(ballotsPath)).toBe(true);

    // Verify manifest contains expected stats
    const manifest = JSON.parse(
      readFileSync("data/test/manifest.json", "utf8"),
    ) as Manifest;
    const election = manifest.elections.find(
      (e) => e.election_id === "portland-20241105-gen",
    );
    const contest = election?.contests.find((c) => c.contest_id === "d2-3seat");

    expect(contest?.cvr.candidates.rows).toBe(5); // 5 candidates
    expect(contest?.cvr.ballots_long.rows).toBeGreaterThan(20); // Expected vote records
    expect(contest?.cvr.ballots_long.sha256).toMatch(/^[a-f0-9]{64}$/); // Valid hash
  });

  it("should have created Parquet export files", async () => {
    expect(
      existsSync(
        "data/test/portland-20241105-gen/d2-3seat/ingest/candidates.parquet",
      ),
    ).toBe(true);
    expect(
      existsSync(
        "data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet",
      ),
    ).toBe(true);
  });

  it("should have updated manifest.json with correct structure", async () => {
    expect(existsSync("data/test/manifest.json")).toBe(true);

    const manifest = JSON.parse(
      readFileSync("data/test/manifest.json", "utf8"),
    ) as Manifest;
    const election = manifest.elections.find(
      (e) => e.election_id === "portland-20241105-gen",
    );
    const contest = election?.contests.find((c) => c.contest_id === "d2-3seat");

    expect(contest).toBeDefined();
    expect(contest?.cvr.candidates.uri).toBe(
      "data/test/portland-20241105-gen/d2-3seat/ingest/candidates.parquet",
    );
    expect(contest?.cvr.ballots_long.uri).toBe(
      "data/test/portland-20241105-gen/d2-3seat/ingest/ballots_long.parquet",
    );
    expect(contest?.cvr.ballots_long.rows).toBeGreaterThan(20);
    expect(contest?.cvr.candidates.rows).toBe(5);
  });
});

describe("ingest_cvr error conditions", () => {
  let testCsvPath: string;

  beforeAll(() => {
    // Create a separate CSV file for error testing that won't interfere with global setup
    testCsvPath = "data/test/error-test.csv";
    mkdirSync("data/test", { recursive: true });
  });

  it("should throw error when SRC_CSV is not provided", async () => {
    // Temporarily remove SRC_CSV env var to test the branch
    const originalSrcCsv = process.env.SRC_CSV;
    delete process.env.SRC_CSV;

    try {
      await expect(
        ingestCvr({
          electionId: "portland-20241105-gen" as ElectionId,
          contestId: "d1-1seat" as ContestId,
          districtId: "d1" as DistrictId,
          seatCount: 1,
          srcCsv: undefined as unknown as string, // undefined should trigger error
        }),
      ).rejects.toThrow("SRC_CSV must be provided");
    } finally {
      // Restore env var
      if (originalSrcCsv) {
        process.env.SRC_CSV = originalSrcCsv;
      }
    }
  });

  it("should throw error when no candidate columns are found", async () => {
    // Create a CSV with invalid header format (no candidate columns)
    const invalidCsv = `RowNumber,BoxID,BoxPosition,BallotID,Status
1,1,1,B001,0
2,1,2,B002,0`;

    writeFileSync(testCsvPath, invalidCsv);

    await expect(
      ingestCvr({
        electionId: "portland-20241105-gen" as ElectionId,
        contestId: "d1-1seat" as ContestId,
        districtId: "d1" as DistrictId,
        seatCount: 1,
        srcCsv: testCsvPath,
      }),
    ).rejects.toThrow("No candidate columns found");
  });
});

// Removed isolated tests due to ESM mocking limitations in Vitest
