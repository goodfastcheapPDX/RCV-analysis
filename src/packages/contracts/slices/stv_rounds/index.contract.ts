import { z } from "zod";

// STV Rounds output schema - one row per candidate per round
export const StvRoundsOutput = z.object({
  round: z.number().int().positive(),
  candidate_name: z.string().min(1),
  votes: z.number().nonnegative(),
  status: z.enum(["standing", "elected", "eliminated"]),
});

// STV Meta output schema - one row per round with round-level information
export const StvMetaOutput = z.object({
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
