import { z } from "zod";
import { IdentitySchema } from "@/contracts/ids";

// Output schema - defines the structure of each row in the candidate_affinity_proximity.parquet file
export const Output = IdentitySchema.extend({
  candidate_a: z.number().int().positive(), // canonical: a < b numerically
  candidate_b: z.number().int().positive(),
  weight_sum: z.number().nonnegative(), // Σ α^(|rA-rB|-1)
  pair_count: z.number().int().nonnegative(), // ballots with both present
  avg_distance: z.number().nonnegative(), // AVG(|rA - rB|)
})
  .refine((data) => data.candidate_a !== data.candidate_b, {
    message:
      "Self pairs are not allowed: candidate_a must not equal candidate_b",
  })
  .refine((data) => data.candidate_a < data.candidate_b, {
    message:
      "Canonical ordering required: candidate_a must be less than candidate_b",
  })
  .refine((data) => data.weight_sum <= data.pair_count, {
    message: "weight_sum must not exceed pair_count (since α ≤ 1)",
  })
  .refine((data) => data.pair_count === 0 || data.avg_distance >= 1, {
    message: "avg_distance must be >= 1 when pair_count > 0",
  })
  .refine((data) => data.pair_count === 0 || data.avg_distance <= 5, {
    message: "avg_distance must be <= 5 when pair_count > 0",
  });

// Stats schema - defines the structure of manifest stats section
export const Stats = z.object({
  total_ballots_considered: z.number().int().positive(),
  unique_pairs: z.number().int().nonnegative(),
  alpha: z.number().nonnegative(), // = 0.5
  max_weight_sum: z.number().nonnegative(),
  compute_ms: z.number().int().nonnegative(),
});

// Data schema - defines the structure of manifest data section
export const Data = z.object({
  rows: z.number().int().nonnegative(),
});

// Full output schema for compute function return
export const CandidateAffinityProximityOutput = z.object({
  stats: Stats,
  data: Data,
});

// Type exports following new naming convention
export type Output = z.infer<typeof Output>;
export type Stats = z.infer<typeof Stats>;
export type Data = z.infer<typeof Data>;
export type CandidateAffinityProximityOutput = z.infer<
  typeof CandidateAffinityProximityOutput
>;

export const version = "0.1.0";

export const SQL_QUERIES = {
  createBallotsLongView: (inputPath: string) => `
    CREATE OR REPLACE VIEW ballots_long AS 
    SELECT * FROM '${inputPath}/ballots_long.parquet';
  `,

  computeProximityMatrix: `
    WITH ranked AS (
      SELECT BallotID, candidate_id, ANY_VALUE(rank_position) as rank_position
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id  -- dedup, taking any rank if duplicates exist
    ),
    tot AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ranked
    ),
    pairs AS (
      SELECT a.candidate_id AS candidate_a,
             b.candidate_id AS candidate_b,
             ABS(a.rank_position - b.rank_position) AS distance,
             POWER(0.5, ABS(a.rank_position - b.rank_position) - 1) AS w
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id   -- canonical unordered pair
       AND a.rank_position != b.rank_position -- skip tied ranks (distance = 0)
    ),
    aggregated AS (
      SELECT candidate_a,
             candidate_b,
             SUM(w) AS weight_sum,
             COUNT(*) AS pair_count,
             AVG(distance) AS avg_distance
      FROM pairs
      GROUP BY 1,2
    )
    SELECT candidate_a, candidate_b, weight_sum, pair_count, avg_distance
    FROM aggregated;
  `,

  getProximityMatrixStats: `
    WITH ranked AS (
      SELECT BallotID, candidate_id, ANY_VALUE(rank_position) as rank_position
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
             ABS(a.rank_position - b.rank_position) AS distance,
             POWER(0.5, ABS(a.rank_position - b.rank_position) - 1) AS w
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
       AND a.rank_position != b.rank_position -- skip tied ranks (distance = 0)
    ),
    aggregated AS (
      SELECT candidate_a,
             candidate_b,
             SUM(w) AS weight_sum,
             COUNT(*) AS pair_count,
             AVG(distance) AS avg_distance
      FROM pairs
      GROUP BY 1,2
    ),
    data_stats AS (
      SELECT COUNT(*) AS rows 
      FROM candidate_affinity_proximity_tmp
    ),
    proximity_stats AS (
      SELECT MAX(weight_sum) AS max_weight_sum
      FROM candidate_affinity_proximity_tmp
    )
    SELECT 
      JSON_OBJECT(
        'stats', JSON_OBJECT(
          'total_ballots_considered', t.total_ballots,
          'unique_pairs', COUNT(a.candidate_a),
          'alpha', 0.5,
          'max_weight_sum', ps.max_weight_sum,
          'compute_ms', 0
        ),
        'data', JSON_OBJECT(
          'rows', ds.rows
        )
      ) AS result
    FROM aggregated a CROSS JOIN tot t, data_stats ds, proximity_stats ps;
  `,

  exportProximityMatrix: `
    CREATE OR REPLACE TABLE candidate_affinity_proximity_tmp AS
    WITH ranked AS (
      SELECT BallotID, candidate_id, ANY_VALUE(rank_position) as rank_position
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
             ABS(a.rank_position - b.rank_position) AS distance,
             POWER(0.5, ABS(a.rank_position - b.rank_position) - 1) AS w
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
       AND a.rank_position != b.rank_position -- skip tied ranks (distance = 0)
    ),
    aggregated AS (
      SELECT candidate_a,
             candidate_b,
             SUM(w) AS weight_sum,
             COUNT(*) AS pair_count,
             AVG(distance) AS avg_distance
      FROM pairs
      GROUP BY 1,2
    )
    SELECT candidate_a, candidate_b, weight_sum, pair_count, avg_distance
    FROM aggregated
    ORDER BY candidate_a, candidate_b;
  `,

  copyToParquet: (outputPath: string) => `
    COPY candidate_affinity_proximity_with_identity TO '${outputPath}/candidate_affinity_proximity.parquet' (FORMAT 'parquet');
  `,
} as const;

export const VALIDATION_RULES = {
  structuralChecks: [
    "All weight_sum values >= 0",
    "All pair_count values >= 0",
    "All avg_distance values >= 0",
    "candidate_a < candidate_b for all rows",
    "No self pairs: candidate_a != candidate_b",
    "weight_sum <= pair_count for all rows (since α ≤ 1)",
  ],
  semanticChecks: [
    "pair_count <= total_ballots_considered for all rows",
    "avg_distance >= 1 when pair_count > 0",
    "avg_distance <= 5 when pair_count > 0",
    "max_weight_sum >= 0",
    "unique_pairs equals number of distinct (candidate_a, candidate_b) pairs",
  ],
  mathematicalChecks: [
    "weight_sum = Σ(α^(distance-1)) for each pair",
    "avg_distance = AVG(|rA - rB|) for each pair",
    "Adjacent ranks (distance=1) contribute weight=1.0",
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
  weight_sum: 125.5,
  pair_count: 150,
  avg_distance: 2.3,
  ...overrides,
});

export const createStatsFixture = (overrides: Partial<Stats> = {}): Stats => ({
  total_ballots_considered: 200,
  unique_pairs: 15,
  alpha: 0.5,
  max_weight_sum: 145.2,
  compute_ms: 250,
  ...overrides,
});

export const createDataFixture = (overrides: Partial<Data> = {}): Data => ({
  rows: 15, // C(6,2) = 15 pairs for 6 candidates
  ...overrides,
});

export const createCandidateAffinityProximityOutputFixture = (
  overrides: Partial<CandidateAffinityProximityOutput> = {},
): CandidateAffinityProximityOutput => ({
  stats: createStatsFixture(overrides.stats),
  data: createDataFixture(overrides.data),
  ...overrides,
});
