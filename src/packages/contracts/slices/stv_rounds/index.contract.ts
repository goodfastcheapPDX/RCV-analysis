import { z } from "zod";
import { IdentitySchema } from "@/contracts/ids";

// STV Rounds output schema - one row per candidate per round
export const StvRoundsOutput = IdentitySchema.extend({
  round: z.number().int().positive(),
  candidate_name: z.string().min(1),
  votes: z.number().nonnegative(),
  status: z.enum(["standing", "elected", "eliminated"]),
});

// STV Meta output schema - one row per round with round-level information
export const StvMetaOutput = IdentitySchema.extend({
  round: z.number().int().positive(),
  quota: z.number().positive(),
  exhausted: z.number().nonnegative(),
  elected_this_round: z.array(z.string()).optional().nullable(),
  eliminated_this_round: z.array(z.string()).optional().nullable(),
});

// Rules schema for YAML configuration
export const RulesSchema = z.object({
  seats: z.number().int().positive(),
  quota: z.enum(["droop"]).default("droop"),
  surplus_method: z.enum(["fractional"]).default("fractional"),
  precision: z.number().positive().default(1e-6),
  tie_break: z.enum(["lexicographic", "random"]).default("lexicographic"),
  random_seed: z.number().int().optional(),
});

// Stats schema for manifest
export const StvRoundsStats = z.object({
  number_of_rounds: z.number().int().positive(),
  winners: z.array(z.string()),
  seats: z.number().int().positive(),
  first_round_quota: z.number().positive(),
  precision: z.number().positive(),
});

// Type exports
export type StvRoundsOutput = z.infer<typeof StvRoundsOutput>;
export type StvMetaOutput = z.infer<typeof StvMetaOutput>;
export type RulesSchema = z.infer<typeof RulesSchema>;
export type StvRoundsStats = z.infer<typeof StvRoundsStats>;

// Legacy exports for backward compatibility
export const OutputRow = StvRoundsOutput;
export const MetaRow = StvMetaOutput;
export const Stats = StvRoundsStats;

export const version = "1.0.0";
export const CONTRACT_VERSION = version;

// Test fixture generators - single source of truth for test data
export const createStvRoundsOutputFixture = (
  overrides: Partial<StvRoundsOutput> = {},
): StvRoundsOutput => ({
  election_id: "portland-20241105-gen",
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  round: 1,
  candidate_name: "Test Candidate",
  votes: 100.0,
  status: "standing",
  ...overrides,
});

export const createStvMetaOutputFixture = (
  overrides: Partial<StvMetaOutput> = {},
): StvMetaOutput => ({
  election_id: "portland-20241105-gen",
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  round: 1,
  quota: 134.0,
  exhausted: 0.0,
  elected_this_round: null,
  eliminated_this_round: null,
  ...overrides,
});

export const createStvRoundsStatsFixture = (
  overrides: Partial<StvRoundsStats> = {},
): StvRoundsStats => ({
  number_of_rounds: 2,
  winners: ["Test Winner"],
  seats: 3,
  first_round_quota: 134.0,
  precision: 0.000001,
  ...overrides,
});
