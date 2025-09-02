import { z } from "zod";
import { IdentitySchema } from "@/contracts/ids";

// Output schema - defines the structure of each row in the rank_distribution.parquet file
export const Output = IdentitySchema.extend({
  candidate_id: z.number().int().positive(),
  rank_position: z.number().int().positive().min(1).max(10), // Consistent with ingest_cvr
  count: z.number().int().nonnegative(),
  pct_all_ballots: z.number().min(0).max(1), // Proportion, not percentage
  pct_among_rankers: z.number().min(0).max(1), // Proportion, not percentage
  pct_among_position_rankers: z.number().min(0).max(1), // Proportion, not percentage
});

// Stats schema - defines the structure of manifest stats section
export const Stats = z.object({
  max_rank: z.number().int().positive(),
  total_ballots: z.number().int().nonnegative(),
  candidate_count: z.number().int().positive(),
  zero_rank_candidates: z.number().int().nonnegative(),
});

// Data schema - defines the structure of manifest data section
export const Data = z.object({
  rows: z.number().int().nonnegative(),
});

// Full output schema for compute function return
export const RankDistributionByCandidateOutput = z.object({
  stats: Stats,
  data: Data,
});

// Type exports following new naming convention
export type Output = z.infer<typeof Output>;
export type Stats = z.infer<typeof Stats>;
export type Data = z.infer<typeof Data>;
export type RankDistributionByCandidateOutput = z.infer<
  typeof RankDistributionByCandidateOutput
>;

export const version = "1.0.0";

export const SQL_QUERIES = {
  createBallotsLongView: (inputPath: string) => `
    CREATE OR REPLACE VIEW ballots_long AS 
    SELECT * FROM '${inputPath}/ballots_long.parquet';
  `,

  computeRankDistribution: `
    WITH contest_ballots AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ballots_long
      WHERE has_vote = TRUE
    ),
    contest_candidates AS (
      SELECT DISTINCT candidate_id
      FROM ballots_long
    ),
    max_rank_found AS (
      SELECT MAX(rank_position) AS max_rank
      FROM ballots_long
      WHERE has_vote = TRUE AND rank_position IS NOT NULL
    ),
    rank_rows AS (
      SELECT candidate_id, rank_position, BallotID
      FROM ballots_long
      WHERE has_vote = TRUE 
        AND rank_position IS NOT NULL 
        AND rank_position >= 1
    ),
    counts AS (
      SELECT 
        candidate_id, 
        rank_position, 
        COUNT(DISTINCT BallotID) AS count
      FROM rank_rows
      GROUP BY candidate_id, rank_position
    ),
    rankers AS (
      SELECT 
        candidate_id,
        COUNT(DISTINCT BallotID) AS total_rankers
      FROM rank_rows
      GROUP BY candidate_id
    ),
    rankers_by_position AS (
      SELECT 
        rank_position,
        COUNT(DISTINCT BallotID) AS total_rankers_at_position
      FROM rank_rows
      GROUP BY rank_position
    ),
    -- Generate dense grid of all candidates × all ranks (1..max_rank)
    rank_grid AS (
      SELECT 
        cc.candidate_id,
        r.rank_position
      FROM contest_candidates cc
      CROSS JOIN (
        SELECT range AS rank_position 
        FROM range(1, (SELECT max_rank + 1 FROM max_rank_found))
      ) r
    ),
    -- Left join to ensure zero counts appear
    complete_counts AS (
      SELECT 
        rg.candidate_id,
        rg.rank_position,
        COALESCE(c.count, 0) AS count,
        COALESCE(r.total_rankers, 0) AS total_rankers,
        COALESCE(rbp.total_rankers_at_position, 0) AS total_rankers_at_position,
        cb.total_ballots
      FROM rank_grid rg
      LEFT JOIN counts c 
        ON rg.candidate_id = c.candidate_id 
        AND rg.rank_position = c.rank_position
      LEFT JOIN rankers r ON rg.candidate_id = r.candidate_id
      LEFT JOIN rankers_by_position rbp ON rg.rank_position = rbp.rank_position
      CROSS JOIN contest_ballots cb
    )
    SELECT 
      candidate_id,
      rank_position,
      count,
      CASE 
        WHEN total_ballots > 0 THEN CAST(count AS DOUBLE) / CAST(total_ballots AS DOUBLE)
        ELSE 0.0 
      END AS pct_all_ballots,
      CASE 
        WHEN total_rankers > 0 THEN CAST(count AS DOUBLE) / CAST(total_rankers AS DOUBLE)
        ELSE 0.0 
      END AS pct_among_rankers,
      CASE 
        WHEN total_rankers_at_position > 0 THEN CAST(count AS DOUBLE) / CAST(total_rankers_at_position AS DOUBLE)
        ELSE 0.0 
      END AS pct_among_position_rankers
    FROM complete_counts
    ORDER BY candidate_id, rank_position;
  `,

  getRankDistributionStats: `
    WITH contest_ballots AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ballots_long
      WHERE has_vote = TRUE
    ),
    contest_candidates AS (
      SELECT COUNT(DISTINCT candidate_id) AS candidate_count
      FROM ballots_long
    ),
    max_rank_found AS (
      SELECT MAX(rank_position) AS max_rank
      FROM ballots_long
      WHERE has_vote = TRUE AND rank_position IS NOT NULL
    ),
    rankers AS (
      SELECT 
        candidate_id,
        COUNT(DISTINCT BallotID) AS total_rankers
      FROM ballots_long
      WHERE has_vote = TRUE 
        AND rank_position IS NOT NULL 
        AND rank_position >= 1
      GROUP BY candidate_id
    ),
    zero_rank_candidates AS (
      SELECT COUNT(*) AS zero_rank_count
      FROM (
        SELECT candidate_id
        FROM ballots_long
        GROUP BY candidate_id
        HAVING SUM(CASE WHEN has_vote = TRUE AND rank_position IS NOT NULL THEN 1 ELSE 0 END) = 0
      )
    ),
    data_stats AS (
      SELECT COUNT(*) AS rows 
      FROM rank_distribution_tmp
    )
    SELECT 
      JSON_OBJECT(
        'stats', JSON_OBJECT(
          'max_rank', mr.max_rank,
          'total_ballots', cb.total_ballots,
          'candidate_count', cc.candidate_count,
          'zero_rank_candidates', zrc.zero_rank_count
        ),
        'data', JSON_OBJECT(
          'rows', ds.rows
        )
      ) AS result
    FROM max_rank_found mr, contest_ballots cb, contest_candidates cc, zero_rank_candidates zrc, data_stats ds;
  `,

  exportRankDistribution: `
    CREATE OR REPLACE TABLE rank_distribution_tmp AS
    WITH contest_ballots AS (
      SELECT COUNT(DISTINCT BallotID) AS total_ballots
      FROM ballots_long
      WHERE has_vote = TRUE
    ),
    contest_candidates AS (
      SELECT DISTINCT candidate_id
      FROM ballots_long
    ),
    max_rank_found AS (
      SELECT MAX(rank_position) AS max_rank
      FROM ballots_long
      WHERE has_vote = TRUE AND rank_position IS NOT NULL
    ),
    rank_rows AS (
      SELECT candidate_id, rank_position, BallotID
      FROM ballots_long
      WHERE has_vote = TRUE 
        AND rank_position IS NOT NULL 
        AND rank_position >= 1
    ),
    counts AS (
      SELECT 
        candidate_id, 
        rank_position, 
        COUNT(DISTINCT BallotID) AS count
      FROM rank_rows
      GROUP BY candidate_id, rank_position
    ),
    rankers AS (
      SELECT 
        candidate_id,
        COUNT(DISTINCT BallotID) AS total_rankers
      FROM rank_rows
      GROUP BY candidate_id
    ),
    rankers_by_position AS (
      SELECT 
        rank_position,
        COUNT(DISTINCT BallotID) AS total_rankers_at_position
      FROM rank_rows
      GROUP BY rank_position
    ),
    -- Generate dense grid of all candidates × all ranks (1..max_rank)
    rank_grid AS (
      SELECT 
        cc.candidate_id,
        r.rank_position
      FROM contest_candidates cc
      CROSS JOIN (
        SELECT range AS rank_position 
        FROM range(1, (SELECT max_rank + 1 FROM max_rank_found))
      ) r
    ),
    -- Left join to ensure zero counts appear
    complete_counts AS (
      SELECT 
        rg.candidate_id,
        rg.rank_position,
        COALESCE(c.count, 0) AS count,
        COALESCE(r.total_rankers, 0) AS total_rankers,
        COALESCE(rbp.total_rankers_at_position, 0) AS total_rankers_at_position,
        cb.total_ballots
      FROM rank_grid rg
      LEFT JOIN counts c 
        ON rg.candidate_id = c.candidate_id 
        AND rg.rank_position = c.rank_position
      LEFT JOIN rankers r ON rg.candidate_id = r.candidate_id
      LEFT JOIN rankers_by_position rbp ON rg.rank_position = rbp.rank_position
      CROSS JOIN contest_ballots cb
    )
    SELECT 
      candidate_id,
      rank_position,
      count,
      CASE 
        WHEN total_ballots > 0 THEN CAST(count AS DOUBLE) / CAST(total_ballots AS DOUBLE)
        ELSE 0.0 
      END AS pct_all_ballots,
      CASE 
        WHEN total_rankers > 0 THEN CAST(count AS DOUBLE) / CAST(total_rankers AS DOUBLE)
        ELSE 0.0 
      END AS pct_among_rankers,
      CASE 
        WHEN total_rankers_at_position > 0 THEN CAST(count AS DOUBLE) / CAST(total_rankers_at_position AS DOUBLE)
        ELSE 0.0 
      END AS pct_among_position_rankers
    FROM complete_counts
    ORDER BY candidate_id, rank_position;
  `,

  copyToParquet: (outputPath: string) => `
    COPY rank_distribution_with_identity TO '${outputPath}/rank_distribution.parquet' (FORMAT 'parquet');
  `,
} as const;

export const VALIDATION_RULES = {
  structuralChecks: [
    "All count values >= 0",
    "All rank_position values in [1, max_rank]",
    "All pct_all_ballots values in [0, 1]",
    "All pct_among_rankers values in [0, 1]",
    "Dense grid: each candidate appears for every rank_position 1..max_rank",
  ],
  semanticChecks: [
    "For each candidate: sum(count over all rank_position) == total_rankers",
    "For each rank_position: sum(count over all candidates) <= total_ballots",
    "Zero-rank candidates have count=0 and pct_*=0 for all ranks",
    "Candidates with rankers have pct_among_rankers sum to 1.0 (within tolerance)",
  ],
  mathematicalChecks: [
    "pct_all_ballots = count / total_ballots (within float tolerance)",
    "pct_among_rankers = count / total_rankers (within float tolerance)",
    "total_ballots matches ballots_with_votes from ingest_cvr manifest",
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
  candidate_id: 1,
  rank_position: 1,
  count: 5,
  pct_all_ballots: 0.25,
  pct_among_rankers: 0.5,
  pct_among_position_rankers: 0.33,
  ...overrides,
});

export const createStatsFixture = (overrides: Partial<Stats> = {}): Stats => ({
  max_rank: 3,
  total_ballots: 20,
  candidate_count: 5,
  zero_rank_candidates: 0,
  ...overrides,
});

export const createDataFixture = (overrides: Partial<Data> = {}): Data => ({
  rows: 15, // 5 candidates × 3 ranks
  ...overrides,
});

export const createRankDistributionByCandidateOutputFixture = (
  overrides: Partial<RankDistributionByCandidateOutput> = {},
): RankDistributionByCandidateOutput => ({
  stats: createStatsFixture(overrides.stats),
  data: createDataFixture(overrides.data),
  ...overrides,
});
