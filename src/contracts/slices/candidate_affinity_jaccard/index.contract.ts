import { z } from "zod";
import { IdentitySchema } from "@/contracts/ids";

// Output schema - defines the structure of each row in the candidate_affinity_jaccard.parquet file
export const Output = IdentitySchema.extend({
  candidate_a: z.number().int().positive(), // canonical: a < b numerically
  candidate_b: z.number().int().positive(),
  pair_count: z.number().int().nonnegative(), // |A∧B|
  presence_a: z.number().int().nonnegative(), // |A|
  presence_b: z.number().int().nonnegative(), // |B|
  union_count: z.number().int().nonnegative(), // |A| + |B| - |A∧B|
  jaccard: z.number().min(0).max(1), // pair_count / union_count (0 if union_count=0)
})
  .refine((data) => data.candidate_a !== data.candidate_b, {
    message:
      "Self pairs are not allowed: candidate_a must not equal candidate_b",
  })
  .refine((data) => data.candidate_a < data.candidate_b, {
    message:
      "Canonical ordering required: candidate_a must be less than candidate_b",
  })
  .refine((data) => data.pair_count <= data.union_count, {
    message: "pair_count must not exceed union_count",
  });

// Stats schema - defines the structure of manifest stats section
export const Stats = z.object({
  total_ballots_considered: z.number().int().positive(),
  unique_pairs: z.number().int().nonnegative(),
  max_jaccard: z.number().min(0).max(1),
  zero_union_pairs: z.number().int().nonnegative(), // should be 0 in practice
  compute_ms: z.number().int().nonnegative(),
});

// Data schema - defines the structure of manifest data section
export const Data = z.object({
  rows: z.number().int().nonnegative(),
});

// Full output schema for compute function return
export const CandidateAffinityJaccardOutput = z.object({
  stats: Stats,
  data: Data,
});

// Type exports following new naming convention
export type Output = z.infer<typeof Output>;
export type Stats = z.infer<typeof Stats>;
export type Data = z.infer<typeof Data>;
export type CandidateAffinityJaccardOutput = z.infer<
  typeof CandidateAffinityJaccardOutput
>;

export const version = "0.1.0";

export const SQL_QUERIES = {
  createBallotsLongView: (inputPath: string) => `
    CREATE OR REPLACE VIEW ballots_long AS 
    SELECT * FROM '${inputPath}/ballots_long.parquet';
  `,

  computeJaccardMatrix: `
    WITH ranked AS (
      SELECT BallotID, candidate_id
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id
    ),
    tot AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots FROM ranked
    ),
    pres AS (
      SELECT candidate_id, COUNT(DISTINCT BallotID) AS presence
      FROM ranked GROUP BY 1
    ),
    pairs AS (
      SELECT a.candidate_id AS candidate_a,
             b.candidate_id AS candidate_b,
             COUNT(*) AS pair_count
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
      GROUP BY 1,2
    )
    SELECT
      p.candidate_a,
      p.candidate_b,
      p.pair_count,
      pa.presence AS presence_a,
      pb.presence AS presence_b,
      (pa.presence + pb.presence - p.pair_count) AS union_count,
      CASE WHEN (pa.presence + pb.presence - p.pair_count) > 0
           THEN GREATEST(0, LEAST(1, p.pair_count::DOUBLE / (pa.presence + pb.presence - p.pair_count)))
           ELSE 0 END AS jaccard
    FROM pairs p
    JOIN pres pa ON pa.candidate_id = p.candidate_a
    JOIN pres pb ON pb.candidate_id = p.candidate_b;
  `,

  getJaccardMatrixStats: `
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
             COUNT(*) AS pair_count
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
      GROUP BY 1,2
    ),
    data_stats AS (
      SELECT COUNT(*) AS rows 
      FROM candidate_affinity_jaccard_tmp
    ),
    jaccard_stats AS (
      SELECT MAX(jaccard) AS max_jaccard,
             COUNT(CASE WHEN union_count = 0 THEN 1 END) AS zero_union_pairs
      FROM candidate_affinity_jaccard_tmp
    )
    SELECT 
      JSON_OBJECT(
        'stats', JSON_OBJECT(
          'total_ballots_considered', t.total_ballots,
          'unique_pairs', COUNT(p.candidate_a),
          'max_jaccard', js.max_jaccard,
          'zero_union_pairs', js.zero_union_pairs,
          'compute_ms', 0
        ),
        'data', JSON_OBJECT(
          'rows', ds.rows
        )
      ) AS result
    FROM pairs p CROSS JOIN tot t, data_stats ds, jaccard_stats js;
  `,

  exportJaccardMatrix: `
    CREATE OR REPLACE TABLE candidate_affinity_jaccard_tmp AS
    WITH ranked AS (
      SELECT BallotID, candidate_id
      FROM ballots_long
      WHERE rank_position IS NOT NULL
      GROUP BY BallotID, candidate_id
    ),
    tot AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots FROM ranked
    ),
    pres AS (
      SELECT candidate_id, COUNT(DISTINCT BallotID) AS presence
      FROM ranked GROUP BY 1
    ),
    pairs AS (
      SELECT a.candidate_id AS candidate_a,
             b.candidate_id AS candidate_b,
             COUNT(*) AS pair_count
      FROM ranked a
      JOIN ranked b
        ON a.BallotID = b.BallotID
       AND a.candidate_id < b.candidate_id
      GROUP BY 1,2
    )
    SELECT
      p.candidate_a,
      p.candidate_b,
      p.pair_count,
      pa.presence AS presence_a,
      pb.presence AS presence_b,
      (pa.presence + pb.presence - p.pair_count) AS union_count,
      CASE WHEN (pa.presence + pb.presence - p.pair_count) > 0
           THEN GREATEST(0, LEAST(1, p.pair_count::DOUBLE / (pa.presence + pb.presence - p.pair_count)))
           ELSE 0 END AS jaccard
    FROM pairs p
    JOIN pres pa ON pa.candidate_id = p.candidate_a
    JOIN pres pb ON pb.candidate_id = p.candidate_b
    ORDER BY p.candidate_a, p.candidate_b;
  `,

  copyToParquet: (outputPath: string) => `
    COPY candidate_affinity_jaccard_with_identity TO '${outputPath}/candidate_affinity_jaccard.parquet' (FORMAT 'parquet');
  `,
} as const;

export const VALIDATION_RULES = {
  structuralChecks: [
    "All pair_count values >= 0",
    "All presence_a, presence_b values >= 0",
    "All union_count values >= 0",
    "All jaccard values in [0, 1]",
    "candidate_a < candidate_b for all rows",
    "No self pairs: candidate_a != candidate_b",
    "pair_count <= union_count for all rows",
  ],
  semanticChecks: [
    "pair_count <= MIN(presence_a, presence_b) for all rows",
    "presence_a, presence_b <= total_ballots_considered",
    "union_count = presence_a + presence_b - pair_count for all rows",
    "max_jaccard <= 1",
    "unique_pairs equals number of distinct (candidate_a, candidate_b) pairs",
  ],
  mathematicalChecks: [
    "jaccard = pair_count / union_count when union_count > 0 (within float tolerance)",
    "jaccard = 0 when union_count = 0",
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
  pair_count: 150,
  presence_a: 180,
  presence_b: 170,
  union_count: 200,
  jaccard: 0.75,
  ...overrides,
});

export const createStatsFixture = (overrides: Partial<Stats> = {}): Stats => ({
  total_ballots_considered: 200,
  unique_pairs: 15,
  max_jaccard: 0.85,
  zero_union_pairs: 0,
  compute_ms: 250,
  ...overrides,
});

export const createDataFixture = (overrides: Partial<Data> = {}): Data => ({
  rows: 15, // C(6,2) = 15 pairs for 6 candidates
  ...overrides,
});

export const createCandidateAffinityJaccardOutputFixture = (
  overrides: Partial<CandidateAffinityJaccardOutput> = {},
): CandidateAffinityJaccardOutput => ({
  stats: createStatsFixture(overrides.stats),
  data: createDataFixture(overrides.data),
  ...overrides,
});
