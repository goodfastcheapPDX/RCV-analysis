import { z } from "zod";
import { ContestIdSchema, DistrictIdSchema, ElectionIdSchema } from "./ids";

// Artifact reference with URI and content hash for determinism
export const ArtifactRef = z.object({
  uri: z.string().min(1), // relative to project root or absolute (e.g., blob URL)
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "SHA256 hash must be 64 hex characters"),
  rows: z.number().int().nonnegative().optional(),
  bytes: z.number().int().nonnegative().optional(),
});

// STV computation rules
export const StvRules = z.object({
  method: z
    .enum(["meek", "droop-surplus-first", "gregory", "hare"])
    .default("meek"),
  quota: z.enum(["droop", "hare"]).default("droop"),
  precision: z.number().positive().default(1e-9),
  tie_break: z.enum(["lexicographic", "random-seed"]).default("lexicographic"),
  seats: z.number().int().positive(),
});

// Contest definition with all its artifacts
export const Contest = z.object({
  contest_id: ContestIdSchema,
  district_id: DistrictIdSchema,
  seat_count: z.number().int().positive(),
  title: z.string().min(1), // "City Council District 2 (3 seats)"

  // Core artifacts
  cvr: z.object({
    candidates: ArtifactRef, // candidates.parquet
    ballots_long: ArtifactRef, // ballots_long.parquet
  }),

  // Analysis artifacts
  first_choice: ArtifactRef.optional(), // first_choice.parquet
  stv: z.object({
    rounds: ArtifactRef.optional(), // stv_rounds.parquet
    meta: ArtifactRef.optional(), // stv_meta.parquet
    stats: z
      .object({
        number_of_rounds: z.number().int().positive(),
        winners: z.array(z.string()),
        seats: z.number().int().positive(),
        first_round_quota: z.number().positive(),
        precision: z.number().positive(),
      })
      .optional(),
  }),

  // Rules and validation
  rules: StvRules,
  official: z
    .object({
      summary_json: z.string().optional(), // published ground truth (URL or path)
      notes: z.string().optional(),
    })
    .optional(),
});

// Election containing multiple contests
export const Election = z.object({
  election_id: ElectionIdSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"), // "2024-11-05"
  jurisdiction: z.string().min(1), // "portland"
  title: z.string().min(1), // "Portland General Election 2024"
  contests: z.array(Contest).nonempty(),
});

// Root manifest
export const Manifest = z.object({
  env: z.enum(["dev", "test", "prod"]),
  version: z.literal(2), // Bumped for multi-election support

  // Input hashes for determinism checking
  inputs: z.record(
    z.string(),
    z.object({
      cvr_files: z.array(
        z.object({
          path: z.string(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      ),
      rules_hash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    }),
  ),

  elections: z.array(Election).nonempty(),
});

// Type exports
export type ArtifactRef = z.infer<typeof ArtifactRef>;
export type StvRules = z.infer<typeof StvRules>;
export type Contest = z.infer<typeof Contest>;
export type Election = z.infer<typeof Election>;
export type Manifest = z.infer<typeof Manifest>;

// Utility functions for manifest operations
export function findElection(
  manifest: Manifest,
  electionId: string,
): Election | undefined {
  return manifest.elections.find((e) => e.election_id === electionId);
}

export function findContest(
  manifest: Manifest,
  electionId: string,
  contestId: string,
): Contest | undefined {
  const election = findElection(manifest, electionId);
  return election?.contests.find((c) => c.contest_id === contestId);
}

export function getArtifactUri(ref: ArtifactRef): string {
  // In dev mode, return relative paths as-is
  // In production, this could map to blob URLs
  return ref.uri;
}

// Test fixture generators - single source of truth for test data
export const createArtifactRefFixture = (
  overrides: Partial<ArtifactRef> = {},
): ArtifactRef => ({
  uri: "test/fixture.parquet",
  sha256: "a".repeat(64),
  rows: 100,
  ...overrides,
});

export const createStvRulesFixture = (
  overrides: Partial<StvRules> = {},
): StvRules => ({
  method: "meek",
  quota: "droop",
  precision: 1e-9,
  tie_break: "lexicographic",
  seats: 3,
  ...overrides,
});

export const createContestFixture = (
  overrides: Partial<Contest> = {},
): Contest => ({
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  title: "Test Contest",
  cvr: {
    candidates: createArtifactRefFixture({ uri: "test/candidates.parquet" }),
    ballots_long: createArtifactRefFixture({ uri: "test/ballots.parquet" }),
  },
  stv: {},
  rules: createStvRulesFixture(),
  ...overrides,
});

export const createElectionFixture = (
  overrides: Partial<Election> = {},
): Election => ({
  election_id: "portland-20241105-gen",
  date: "2024-11-05",
  jurisdiction: "portland",
  title: "Test Election",
  contests: [createContestFixture()],
  ...overrides,
});
