import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeStvRounds } from "./compute.js";
import {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "./index.contract.js";

// Mock the contract enforcer functions
vi.mock(
  "@/packages/contracts/lib/contract-enforcer",
  async (importOriginal) => {
    const actual: any = await importOriginal();
    let validateCalls: any[] = [];
    let parseCallsCounter = 0;
    let assertManifestCalls: any[] = [];

    return {
      ...actual,
      assertTableColumns: vi.fn(
        async (conn: DuckDBConnection, table: string, schema: any) => {
          validateCalls.push({
            type: "assertTableColumns",
            table,
            schema: schema.constructor.name,
          });
          return Promise.resolve();
        },
      ),
      parseAllRows: vi.fn(
        async (conn: DuckDBConnection, table: string, schema: any) => {
          parseCallsCounter++;
          validateCalls.push({
            type: "parseAllRows",
            table,
            schema: schema.constructor.name,
          });

          // Return mock data that matches our schemas
          if (table === "tmp_stv_rounds") {
            return [
              {
                round: 1,
                candidate_name: "Candidate A",
                votes: 100,
                status: "standing",
              },
              {
                round: 1,
                candidate_name: "Candidate B",
                votes: 80,
                status: "standing",
              },
            ];
          } else if (table === "tmp_stv_meta") {
            return [
              {
                round: 1,
                quota: 51,
                exhausted: 0,
                elected_this_round: null,
                eliminated_this_round: null,
              },
            ];
          }
          return [];
        },
      ),
      assertManifestSection: vi.fn(
        async (path: string, key: string, schema: any) => {
          assertManifestCalls.push({
            path,
            key,
            schema: schema.constructor.name,
          });
          return Promise.resolve();
        },
      ),
      sha256: vi.fn(
        (filePath: string) => `mock-hash-${filePath.split("/").pop()}`,
      ),
      validateDependencies: vi.fn(() => {
        // Mock successful dependency validation by default
        return;
      }),
      __getValidateCalls: () => validateCalls,
      __getParseCallsCounter: () => parseCallsCounter,
      __getAssertManifestCalls: () => assertManifestCalls,
      __resetMocks: () => {
        validateCalls = [];
        parseCallsCounter = 0;
        assertManifestCalls = [];
      },
    };
  },
);

// Mock file system operations
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: vi.fn((path: string) => {
      if (path.includes("rules.yaml")) {
        return "seats: 3\nquota: droop\nsurplus_method: fractional\nprecision: 1e-6\ntie_break: lexicographic";
      }
      if (path.includes("manifest.json")) {
        return "{}";
      }
      return "";
    }),
    existsSync: vi.fn((path: string) => {
      return (
        path.includes("ballots_long.parquet") || path.includes("rules.yaml")
      );
    }),
    mkdirSync: vi.fn(),
  };
});

// Mock DuckDB
vi.mock("@duckdb/node-api", () => {
  const mockConn = {
    run: vi.fn(async (query: string, ...params: any[]) => {
      if (query.includes("SELECT BallotID, candidate_name, rank_position")) {
        return {
          getRowObjects: () =>
            Promise.resolve([
              {
                BallotID: "B1",
                candidate_name: "Candidate A",
                rank_position: 1,
              },
              {
                BallotID: "B1",
                candidate_name: "Candidate B",
                rank_position: 2,
              },
              {
                BallotID: "B2",
                candidate_name: "Candidate B",
                rank_position: 1,
              },
              {
                BallotID: "B2",
                candidate_name: "Candidate A",
                rank_position: 2,
              },
            ]),
        };
      }
      return { getRowObjects: () => Promise.resolve([]) };
    }),
    closeSync: vi.fn(),
  };

  const mockDb = {
    connect: vi.fn(() => Promise.resolve(mockConn)),
  };

  return {
    DuckDBInstance: {
      create: vi.fn(() => Promise.resolve(mockDb)),
    },
  };
});

// Mock the STV engine
vi.mock("./engine.js", () => ({
  runSTV: vi.fn((ballotsData, rules) => ({
    rounds: [
      {
        round: 1,
        candidate_name: "Candidate A",
        votes: 1.5,
        status: "elected",
      },
      {
        round: 1,
        candidate_name: "Candidate B",
        votes: 0.5,
        status: "eliminated",
      },
    ],
    meta: [
      {
        round: 1,
        quota: 1.34,
        exhausted: 0,
        elected_this_round: ["Candidate A"],
        eliminated_this_round: ["Candidate B"],
      },
    ],
    winners: ["Candidate A"],
  })),
}));

describe("STV Rounds Contract Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock state
    const contractEnforcer = await import(
      "@/packages/contracts/lib/contract-enforcer"
    );
    (contractEnforcer as any).__resetMocks?.();
  });

  it("should enforce contract validation during compute", async () => {
    const result = await computeStvRounds();

    // Verify contract enforcer functions were called
    const contractEnforcer = await import(
      "@/packages/contracts/lib/contract-enforcer"
    );

    expect(contractEnforcer.assertTableColumns).toHaveBeenCalledWith(
      expect.anything(),
      "tmp_stv_rounds",
      StvRoundsOutput,
    );
    expect(contractEnforcer.assertTableColumns).toHaveBeenCalledWith(
      expect.anything(),
      "tmp_stv_meta",
      StvMetaOutput,
    );

    expect(contractEnforcer.parseAllRows).toHaveBeenCalledWith(
      expect.anything(),
      "tmp_stv_rounds",
      StvRoundsOutput,
    );
    expect(contractEnforcer.parseAllRows).toHaveBeenCalledWith(
      expect.anything(),
      "tmp_stv_meta",
      StvMetaOutput,
    );

    expect(contractEnforcer.assertManifestSection).toHaveBeenCalledWith(
      expect.stringContaining("manifest.test.json"),
      expect.stringMatching(/^stv_rounds@\d+\.\d+\.\d+$/),
      StvRoundsStats,
    );

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

  it("should fail with clear error for data validation", async () => {
    // Mock STV engine to return invalid data
    const { runSTV } = await import("./engine.js");
    vi.mocked(runSTV).mockReturnValue({
      rounds: [
        { round: -1, candidate_name: "", votes: -5, status: "invalid" as any }, // Invalid data
      ],
      meta: [
        {
          round: 1,
          quota: 1.34,
          exhausted: 0,
          elected_this_round: null,
          eliminated_this_round: null,
        },
      ],
      winners: [],
    });

    await expect(computeStvRounds()).rejects.toThrow();
  });

  it("should validate all output schemas", () => {
    // Test StvRoundsOutput schema
    const validRoundRow = {
      round: 1,
      candidate_name: "Test Candidate",
      votes: 100.5,
      status: "standing" as const,
    };
    expect(() => StvRoundsOutput.parse(validRoundRow)).not.toThrow();

    const invalidRoundRow = {
      round: -1, // Invalid: must be positive
      candidate_name: "",
      votes: -1, // Invalid: must be non-negative
      status: "invalid",
    };
    expect(() => StvRoundsOutput.parse(invalidRoundRow)).toThrow();

    // Test StvMetaOutput schema
    const validMetaRow = {
      round: 1,
      quota: 100,
      exhausted: 5.5,
      elected_this_round: ["Candidate A"],
      eliminated_this_round: null,
    };
    expect(() => StvMetaOutput.parse(validMetaRow)).not.toThrow();

    // Test StvRoundsStats schema
    const validStats = {
      number_of_rounds: 5,
      winners: ["Winner 1", "Winner 2"],
      seats: 2,
      first_round_quota: 100,
      precision: 1e-6,
    };
    expect(() => StvRoundsStats.parse(validStats)).not.toThrow();
  });

  it("should handle edge cases in schema validation", () => {
    // Test edge cases for StvRoundsOutput
    expect(() =>
      StvRoundsOutput.parse({
        round: 1,
        candidate_name: "A",
        votes: 0, // Exactly zero should be valid (nonnegative)
        status: "standing",
      }),
    ).not.toThrow();

    expect(() =>
      StvRoundsOutput.parse({
        round: 0, // Invalid: must be positive
        candidate_name: "A",
        votes: 0,
        status: "standing",
      }),
    ).toThrow();

    // Test edge cases for StvMetaOutput
    expect(() =>
      StvMetaOutput.parse({
        round: 1,
        quota: 0.1, // Very small positive number should be valid
        exhausted: 0,
        elected_this_round: [],
        eliminated_this_round: [],
      }),
    ).not.toThrow();

    expect(() =>
      StvMetaOutput.parse({
        round: 1,
        quota: 0, // Invalid: must be positive
        exhausted: 0,
        elected_this_round: null,
        eliminated_this_round: null,
      }),
    ).toThrow();
  });

  it("should validate that contract enforcement prevents schema drift", async () => {
    // Reset the STV engine mock to return valid data
    const { runSTV } = await import("./engine.js");
    vi.mocked(runSTV).mockReturnValue({
      rounds: [
        {
          round: 1,
          candidate_name: "Candidate A",
          votes: 1.5,
          status: "elected",
        },
        {
          round: 1,
          candidate_name: "Candidate B",
          votes: 0.5,
          status: "eliminated",
        },
      ],
      meta: [
        {
          round: 1,
          quota: 1.34,
          exhausted: 0,
          elected_this_round: ["Candidate A"],
          eliminated_this_round: ["Candidate B"],
        },
      ],
      winners: ["Candidate A"],
    });

    await computeStvRounds();

    const contractEnforcer = await import(
      "@/packages/contracts/lib/contract-enforcer"
    );
    const calls = (contractEnforcer as any).__getValidateCalls?.() || [];
    const parseCallsCount =
      (contractEnforcer as any).__getParseCallsCounter?.() || 0;
    const manifestCalls =
      (contractEnforcer as any).__getAssertManifestCalls?.() || [];

    // Verify all required contract enforcement calls were made
    expect(
      calls.filter((c: any) => c.type === "assertTableColumns"),
    ).toHaveLength(2); // rounds + meta
    expect(parseCallsCount).toBeGreaterThanOrEqual(2); // rounds + meta parsing
    expect(manifestCalls).toHaveLength(1); // manifest validation

    // Verify the correct schemas were used
    const tableAssertions = calls.filter(
      (c: any) => c.type === "assertTableColumns",
    );
    expect(tableAssertions.map((c: any) => c.table)).toContain(
      "tmp_stv_rounds",
    );
    expect(tableAssertions.map((c: any) => c.table)).toContain("tmp_stv_meta");
  });
});
