import { z } from "zod";

export const FirstChoiceBreakdownRowSchema = z.object({
  candidate_name: z.string().min(1),
  first_choice_votes: z.number().int().min(0),
  pct: z.number().min(0).max(100),
});

export const FirstChoiceBreakdownOutputSchema = z.object({
  stats: z.object({
    total_valid_ballots: z.number().int().min(0),
    candidate_count: z.number().int().min(0),
    sum_first_choice: z.number().int().min(0),
  }),
  data: z.object({
    rows: z.number().int().min(0),
  }),
});

export type FirstChoiceBreakdownRow = z.infer<
  typeof FirstChoiceBreakdownRowSchema
>;
export type FirstChoiceBreakdownOutput = z.infer<
  typeof FirstChoiceBreakdownOutputSchema
>;

export const CONTRACT_VERSION = "1.0.0";

export const SQL_QUERIES = {
  createFirstChoiceView: `
    CREATE OR REPLACE VIEW ballots_long AS 
    SELECT * FROM 'data/ingest/ballots_long.parquet';
  `,

  computeFirstChoiceBreakdown: `
    WITH firsts AS (
      SELECT BallotID, candidate_name
      FROM ballots_long
      WHERE rank_position = 1 AND has_vote = TRUE
    ),
    totals AS (
      SELECT COUNT(*) AS total_valid_ballots FROM firsts
    ),
    breakdown AS (
      SELECT
        f.candidate_name,
        COUNT(*) AS first_choice_votes,
        ROUND(100.0 * COUNT(*) / t.total_valid_ballots, 4) AS pct
      FROM firsts f CROSS JOIN totals t
      GROUP BY f.candidate_name, t.total_valid_ballots
      ORDER BY first_choice_votes DESC, candidate_name ASC
    )
    SELECT * FROM breakdown;
  `,

  getFirstChoiceStats: `
    WITH firsts AS (
      SELECT BallotID, candidate_name
      FROM ballots_long
      WHERE rank_position = 1 AND has_vote = TRUE
    ),
    breakdown AS (
      SELECT
        f.candidate_name,
        COUNT(*) AS first_choice_votes
      FROM firsts f
      GROUP BY f.candidate_name
    ),
    stats AS (
      SELECT 
        COUNT(*) AS total_valid_ballots,
        COUNT(DISTINCT candidate_name) AS candidate_count,
        COUNT(*) AS sum_first_choice
      FROM firsts
    ),
    data_stats AS (
      SELECT COUNT(*) AS rows FROM breakdown
    )
    SELECT 
      JSON_OBJECT(
        'stats', JSON_OBJECT(
          'total_valid_ballots', stats.total_valid_ballots,
          'candidate_count', stats.candidate_count,
          'sum_first_choice', stats.sum_first_choice
        ),
        'data', JSON_OBJECT(
          'rows', data_stats.rows
        )
      ) AS result
    FROM stats, data_stats;
  `,

  exportFirstChoice: `
    CREATE OR REPLACE TABLE first_choice_breakdown AS
    WITH firsts AS (
      SELECT BallotID, candidate_name
      FROM ballots_long
      WHERE rank_position = 1 AND has_vote = TRUE
    ),
    totals AS (
      SELECT COUNT(*) AS total_valid_ballots FROM firsts
    )
    SELECT
      f.candidate_name,
      COUNT(*) AS first_choice_votes,
      ROUND(100.0 * COUNT(*) / t.total_valid_ballots, 4) AS pct
    FROM firsts f CROSS JOIN totals t
    GROUP BY f.candidate_name, t.total_valid_ballots
    ORDER BY first_choice_votes DESC, candidate_name ASC;
  `,

  copyToParquet: `
    COPY first_choice_breakdown TO 'data/summary/first_choice.parquet' (FORMAT 'parquet');
  `,
} as const;

export const VALIDATION_RULES = {
  structuralChecks: [
    "No NULL candidate_name values",
    "All first_choice_votes >= 0",
    "All pct values between 0 and 100",
    "|sum(pct) - 100| <= 0.01",
  ],
  semanticChecks: [
    "sum(first_choice_votes) == ballots_with_votes from ingest_cvr manifest",
    "candidate_count matches unique candidates in result",
  ],
  officialResultsChecks: [
    "Compare candidate first-choice counts against official JSON (if present)",
    "Name normalization: trim whitespace, case-insensitive comparison",
  ],
} as const;
