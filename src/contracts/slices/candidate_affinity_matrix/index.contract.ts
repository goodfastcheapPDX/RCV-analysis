import { z } from "zod";
import { IdentitySchema } from "@/contracts/ids";

// Output schema - defines the structure of each row in the candidate_affinity_matrix.parquet file
export const Output = IdentitySchema.extend({
  candidate_a: z.number().int().positive(), // canonical: a < b numerically
  candidate_b: z.number().int().positive(),
  cooccurrence_count: z.number().int().nonnegative(),
  cooccurrence_frac: z.number().min(0).max(1), // count / total_ballots_with_any_rank
})
  .refine((data) => data.candidate_a !== data.candidate_b, {
    message:
      "Self pairs are not allowed: candidate_a must not equal candidate_b",
  })
  .refine((data) => data.candidate_a < data.candidate_b, {
    message:
      "Canonical ordering required: candidate_a must be less than candidate_b",
  });

// Stats schema - defines the structure of manifest stats section
export const Stats = z.object({
  total_ballots_considered: z.number().int().positive(),
  unique_pairs: z.number().int().nonnegative(),
  max_pair_frac: z.number().min(0).max(1),
  compute_ms: z.number().int().nonnegative(),
});

// Data schema - defines the structure of manifest data section
export const Data = z.object({
  rows: z.number().int().nonnegative(),
});

// Full output schema for compute function return
export const CandidateAffinityMatrixOutput = z.object({
  stats: Stats,
  data: Data,
});

// Type exports following new naming convention
export type Output = z.infer<typeof Output>;
export type Stats = z.infer<typeof Stats>;
export type Data = z.infer<typeof Data>;
export type CandidateAffinityMatrixOutput = z.infer<
  typeof CandidateAffinityMatrixOutput
>;

export const version = "0.1.0";

export const SQL_QUERIES = {
  createBallotsLongView: (inputPath: string) => `
    CREATE OR REPLACE VIEW ballots_long AS 
    SELECT * FROM '${inputPath}/ballots_long.parquet';
  `,

  computeAffinityMatrix: `
    -- CTE 1: ballots with any valid ranking, deduped
    WITH ranked AS (
      SELECT BallotID, candidate_id
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id  -- dedup
    ),
    -- CTE 2: total ballot count
    tot AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ranked
    ),
    -- CTE 3: generate canonical pairs
    pairs AS (
      SELECT a.candidate_id AS candidate_a,
             b.candidate_id AS candidate_b,
             COUNT(*) AS cooccurrence_count
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id   -- canonical unordered pair
      GROUP BY 1,2
    )
    SELECT p.candidate_a, p.candidate_b, p.cooccurrence_count,
           p.cooccurrence_count::DOUBLE / t.total_ballots AS cooccurrence_frac
    FROM pairs p CROSS JOIN tot t;
  `,

  getAffinityMatrixStats: `
    WITH ranked AS (
      SELECT BallotID, candidate_id
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id
    ),
    tot AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ranked
    ),
    pairs AS (
      SELECT a.candidate_id AS candidate_a,
             b.candidate_id AS candidate_b,
             COUNT(*) AS cooccurrence_count
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
      GROUP BY 1,2
    ),
    data_stats AS (
      SELECT COUNT(*) AS rows 
      FROM candidate_affinity_matrix_tmp
    )
    SELECT 
      JSON_OBJECT(
        'stats', JSON_OBJECT(
          'total_ballots_considered', t.total_ballots,
          'unique_pairs', COUNT(p.candidate_a),
          'max_pair_frac', MAX(p.cooccurrence_count::DOUBLE / t.total_ballots),
          'compute_ms', 0
        ),
        'data', JSON_OBJECT(
          'rows', ds.rows
        )
      ) AS result
    FROM pairs p CROSS JOIN tot t, data_stats ds;
  `,

  exportAffinityMatrix: `
    CREATE OR REPLACE TABLE candidate_affinity_matrix_tmp AS
    WITH ranked AS (
      SELECT BallotID, candidate_id
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id
    ),
    tot AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ranked
    ),
    pairs AS (
      SELECT a.candidate_id AS candidate_a,
             b.candidate_id AS candidate_b,
             COUNT(*) AS cooccurrence_count
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
      GROUP BY 1,2
    )
    SELECT p.candidate_a, p.candidate_b, p.cooccurrence_count,
           p.cooccurrence_count::DOUBLE / t.total_ballots AS cooccurrence_frac
    FROM pairs p CROSS JOIN tot t
    ORDER BY p.candidate_a, p.candidate_b;
  `,

  copyToParquet: (outputPath: string) => `
    COPY candidate_affinity_matrix_with_identity TO '${outputPath}/candidate_affinity_matrix.parquet' (FORMAT 'parquet');
  `,
} as const;

export const VALIDATION_RULES = {
  structuralChecks: [
    "All cooccurrence_count values >= 0",
    "All cooccurrence_frac values in [0, 1]",
    "candidate_a < candidate_b lexicographically for all rows",
    "No self pairs: candidate_a != candidate_b",
  ],
  semanticChecks: [
    "cooccurrence_count <= total_ballots_considered for all rows",
    "max_pair_frac <= 1",
    "unique_pairs equals number of distinct (candidate_a, candidate_b) pairs",
  ],
  mathematicalChecks: [
    "cooccurrence_frac = cooccurrence_count / total_ballots_considered (within float tolerance)",
    "Symmetric reconstruction: matrix M[a,b] == M[b,a] when mirrored",
  ],
} as const;

// Test fixture generators
export const createOutputFixture = (
  overrides: Partial<Output> = {},
): Output => ({
  election_id: "portland-20241105-gen",
  contest_id: "d2-3seat",
  district_id: "d2",
  seat_count: 3,
  candidate_a: 1,
  candidate_b: 2,
  cooccurrence_count: 150,
  cooccurrence_frac: 0.75,
  ...overrides,
});

export const createStatsFixture = (overrides: Partial<Stats> = {}): Stats => ({
  total_ballots_considered: 200,
  unique_pairs: 15,
  max_pair_frac: 0.85,
  compute_ms: 250,
  ...overrides,
});

export const createDataFixture = (overrides: Partial<Data> = {}): Data => ({
  rows: 15, // C(6,2) = 15 pairs for 6 candidates
  ...overrides,
});

export const createCandidateAffinityMatrixOutputFixture = (
  overrides: Partial<CandidateAffinityMatrixOutput> = {},
): CandidateAffinityMatrixOutput => ({
  stats: createStatsFixture(overrides.stats),
  data: createDataFixture(overrides.data),
  ...overrides,
});
