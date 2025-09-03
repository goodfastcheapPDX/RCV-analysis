import { z } from "zod";
import { type Identity, IdentitySchema } from "@/contracts/ids";

// Transfer Matrix output schema - one row per transfer per round
export const Output = IdentitySchema.extend({
  round: z.number().int().positive(),
  from_candidate_name: z.string().min(1),
  to_candidate_name: z.string().min(1).nullable(), // null represents exhausted votes
  vote_count: z.number().nonnegative(),
  transfer_reason: z.enum(["elimination", "surplus"]),
  transfer_weight: z.number().min(0).max(1), // Fractional weight used (1.0 for elimination, <1.0 for surplus)
});

// Stats schema - defines the structure of manifest stats section
export const Stats = z.object({
  total_rounds: z.number().int().positive(),
  total_transfers: z.number().int().nonnegative(),
  total_exhausted_votes: z.number().nonnegative(),
  candidates_with_transfers: z.number().int().nonnegative(),
  surplus_transfers: z.number().int().nonnegative(),
  elimination_transfers: z.number().int().nonnegative(),
});

// Data schema - defines the structure of manifest data section
export const Data = z.object({
  rows: z.number().int().nonnegative(),
});

// Full output schema for compute function return
export const TransferMatrixOutput = z.object({
  stats: Stats,
  data: Data,
});

// Type exports
export type Output = z.infer<typeof Output>;
export type Stats = z.infer<typeof Stats>;
export type Data = z.infer<typeof Data>;
export type TransferMatrixOutput = z.infer<typeof TransferMatrixOutput>;

export const version = "1.0.0";

// Test fixture generators
export const createOutputFixture = (
  overrides: Partial<Output> = {},
): Output => ({
  election_id: "portland-20241105-gen",
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  round: 1,
  from_candidate_name: "Alice Johnson",
  to_candidate_name: "Bob Smith",
  vote_count: 25.5,
  transfer_reason: "elimination",
  transfer_weight: 1.0,
  ...overrides,
});

export const createExhaustedFixture = (
  overrides: Partial<Output> = {},
): Output => ({
  election_id: "portland-20241105-gen",
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  round: 2,
  from_candidate_name: "Charlie Davis",
  to_candidate_name: null, // exhausted
  vote_count: 12.0,
  transfer_reason: "elimination",
  transfer_weight: 1.0,
  ...overrides,
});

export const createStatsFixture = (overrides: Partial<Stats> = {}): Stats => ({
  total_rounds: 3,
  total_transfers: 150,
  total_exhausted_votes: 25,
  candidates_with_transfers: 4,
  surplus_transfers: 50,
  elimination_transfers: 100,
  ...overrides,
});

export const createDataFixture = (overrides: Partial<Data> = {}): Data => ({
  rows: 175, // All transfer records including exhausted
  ...overrides,
});

export const createTransferMatrixOutputFixture = (
  overrides: Partial<TransferMatrixOutput> = {},
): TransferMatrixOutput => ({
  stats: createStatsFixture(overrides.stats),
  data: createDataFixture(overrides.data),
  ...overrides,
});

export const SQL_QUERIES = {
  createStvRoundsView: (inputPath: string) => `
    CREATE OR REPLACE VIEW stv_rounds AS 
    SELECT * FROM '${inputPath}';
  `,

  createStvMetaView: (inputPath: string) => `
    CREATE OR REPLACE VIEW stv_meta AS 
    SELECT * FROM '${inputPath}';
  `,

  createBallotsLongView: (inputPath: string) => `
    CREATE OR REPLACE VIEW ballots_long AS 
    SELECT * FROM '${inputPath}';
  `,

  createTransferMatrix: () => `
    CREATE OR REPLACE TABLE transfer_matrix AS
    WITH round_changes AS (
      -- Identify vote changes between consecutive rounds
      SELECT 
        curr.round,
        curr.candidate_name,
        curr.votes AS current_votes,
        COALESCE(prev.votes, 0) AS previous_votes,
        curr.votes - COALESCE(prev.votes, 0) AS vote_change,
        curr.status AS current_status,
        COALESCE(prev.status, 'standing') AS previous_status,
        meta.elected_this_round,
        meta.eliminated_this_round,
        meta.exhausted - COALESCE(prev_meta.exhausted, 0) AS exhausted_change
      FROM stv_rounds curr
      LEFT JOIN stv_rounds prev 
        ON curr.candidate_name = prev.candidate_name 
        AND curr.round = prev.round + 1
      LEFT JOIN stv_meta meta ON curr.round = meta.round
      LEFT JOIN stv_meta prev_meta ON prev.round = prev_meta.round
      WHERE curr.round > 1 -- Skip first round (no transfers)
    ),
    elimination_transfers AS (
      -- Transfers from eliminated candidates
      -- Only record the actual vote gains (not scaled to eliminated total)
      SELECT 
        rc.round,
        rc.candidate_name AS from_candidate_name,
        recipient.candidate_name AS to_candidate_name,
        -- Record actual vote gains (conservation-preserving)
        recipient.vote_change AS vote_count,
        'elimination' AS transfer_reason,
        1.0 AS transfer_weight
      FROM round_changes rc
      JOIN round_changes recipient ON rc.round = recipient.round AND recipient.vote_change > 0
      WHERE rc.vote_change < 0 
        AND rc.previous_status = 'standing' 
        AND rc.current_status = 'eliminated'
    ),
    surplus_transfers AS (
      -- Transfers from surplus of elected candidates
      -- Only record the actual vote gains (not scaled to surplus total)
      SELECT 
        rc.round,
        rc.candidate_name AS from_candidate_name,
        recipient.candidate_name AS to_candidate_name,
        -- Record actual vote gains (conservation-preserving)
        recipient.vote_change AS vote_count,
        'surplus' AS transfer_reason,
        -- Calculate transfer weight (surplus / total votes before transfer)
        CASE 
          WHEN rc.previous_votes > 0 THEN ABS(rc.vote_change) / rc.previous_votes
          ELSE 0
        END AS transfer_weight
      FROM round_changes rc
      JOIN round_changes recipient ON rc.round = recipient.round AND recipient.vote_change > 0
      WHERE rc.vote_change < 0
        AND rc.current_status = 'elected'
        AND rc.previous_status IN ('standing', 'elected')
    ),
    exhausted_transfers AS (
      -- Votes that became exhausted
      SELECT 
        rc.round,
        rc.candidate_name AS from_candidate_name,
        NULL AS to_candidate_name, -- NULL represents exhausted
        rc.exhausted_change AS vote_count,
        CASE 
          WHEN rc.current_status = 'eliminated' THEN 'elimination'
          ELSE 'surplus'
        END AS transfer_reason,
        CASE 
          WHEN rc.current_status = 'eliminated' THEN 1.0
          WHEN rc.previous_votes > 0 THEN ABS(rc.vote_change) / rc.previous_votes
          ELSE 0
        END AS transfer_weight
      FROM round_changes rc
      WHERE rc.exhausted_change > 0
        AND rc.vote_change < 0
    )
    SELECT * FROM elimination_transfers
    UNION ALL
    SELECT * FROM surplus_transfers  
    UNION ALL
    SELECT * FROM exhausted_transfers
    WHERE vote_count > 0 -- Only include positive transfers
    ORDER BY round, from_candidate_name, to_candidate_name;
  `,

  createTransferMatrixWithIdentity: (identity: Identity) => `
    CREATE OR REPLACE TABLE transfer_matrix_with_identity AS
    SELECT 
      '${identity.election_id}' as election_id,
      '${identity.contest_id}' as contest_id, 
      '${identity.district_id}' as district_id,
      ${identity.seat_count} as seat_count,
      round,
      from_candidate_name,
      to_candidate_name,
      vote_count,
      transfer_reason,
      transfer_weight
    FROM transfer_matrix
    ORDER BY round, from_candidate_name, to_candidate_name;
  `,

  copyToParquet: (outputPath: string) => `
    COPY transfer_matrix_with_identity TO '${outputPath}' (FORMAT 'parquet');
  `,
} as const;

export const VALIDATION_RULES = {
  structuralChecks: [
    "All vote_count values >= 0",
    "All round values > 1 (no transfers in round 1)",
    "All transfer_weight values in [0, 1]",
    "to_candidate_name NULL only for exhausted transfers",
  ],
  conservationChecks: [
    "Total outgoing transfers <= total vote changes",
    "Exhausted votes match meta table exhausted increases",
    "Transfer weights consistent with surplus calculations",
  ],
  semanticChecks: [
    "Elimination transfers have weight = 1.0",
    "Surplus transfers have weight < 1.0 (unless edge case)",
    "From candidates exist in corresponding STV rounds",
    "To candidates are standing in transfer round",
  ],
} as const;
