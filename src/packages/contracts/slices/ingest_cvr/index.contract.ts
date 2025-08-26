import { z } from "zod";

// Candidates output schema - defines structure of candidates.parquet
export const CandidatesOutput = z.object({
  candidate_id: z.number().int().positive(),
  candidate_name: z.string().min(1),
});

// Ballots long output schema - defines structure of ballots_long.parquet
export const BallotsLongOutput = z.object({
  BallotID: z.string().min(1),
  PrecinctID: z.string().min(1),
  BallotStyleID: z.string().min(1),
  candidate_id: z.number().int().positive(),
  candidate_name: z.string().min(1),
  rank_position: z.number().int().min(1).max(10), // Portland allows up to 6 ranks, but be flexible
  has_vote: z.boolean(),
});

// Stats schemas for manifest
export const CandidatesStats = z.object({
  rows: z.number().int().nonnegative(),
});

export const BallotsLongStats = z.object({
  rows: z.number().int().nonnegative(),
  ballots: z.number().int().nonnegative(),
  candidates: z.number().int().nonnegative(),
  min_rank: z.number().int().min(1),
  max_rank: z.number().int().min(1),
  duplicate_ballots: z.number().int().nonnegative(),
});

// Full output schema for compute function return
export const IngestCvrOutput = z.object({
  candidates: CandidatesStats,
  ballots_long: BallotsLongStats,
});

// Type exports following new naming convention
export type CandidatesOutput = z.infer<typeof CandidatesOutput>;
export type BallotsLongOutput = z.infer<typeof BallotsLongOutput>;
export type CandidatesStats = z.infer<typeof CandidatesStats>;
export type BallotsLongStats = z.infer<typeof BallotsLongStats>;
export type IngestCvrOutput = z.infer<typeof IngestCvrOutput>;

// Legacy exports for backward compatibility
export const IngestCvrOutputSchema = IngestCvrOutput;

export const version = "1.0.0";
export const CONTRACT_VERSION = version;

export const SQL_QUERIES = {
  createRawTable: (csvPath: string) => `
    CREATE OR REPLACE TABLE rcv_raw AS
    SELECT * FROM read_csv('${csvPath}', header=true, ignore_errors=true);
  `,

  createCandidatesTable: `
    CREATE OR REPLACE TABLE candidates AS
    WITH headers AS (
      SELECT column_name
      FROM duckdb_columns
      WHERE table_name='rcv_raw'
        AND column_name NOT IN ('BallotID','PrecinctID','BallotStyleID','Status')
    ),
    parsed AS (
      SELECT
        column_name,
        CASE 
          WHEN column_name LIKE 'Choice_%_1:City of Portland, Councilor, District %:%:Number of Winners 3:%:NON' THEN 
            split_part(split_part(column_name, ':', 5), ':', 1)
          ELSE NULL 
        END AS candidate_name,
        CASE 
          WHEN column_name LIKE 'Choice_%_1:City of Portland, Councilor, District %:%:Number of Winners 3:%:NON' THEN 
            TRY_CAST(split_part(column_name, ':', 3) AS INTEGER)
          ELSE NULL 
        END AS rank_position
      FROM headers
    )
    SELECT ROW_NUMBER() OVER (ORDER BY candidate_name) AS candidate_id, candidate_name
    FROM (SELECT DISTINCT candidate_name FROM parsed WHERE candidate_name IS NOT NULL);
  `,

  createCandidateColumnsTable: `
    CREATE OR REPLACE TABLE candidate_columns AS
    WITH headers AS (
      SELECT column_name
      FROM duckdb_columns
      WHERE table_name='rcv_raw'
        AND column_name NOT IN ('BallotID','PrecinctID','BallotStyleID','Status')
    ),
    parsed AS (
      SELECT
        column_name,
        CASE 
          WHEN column_name LIKE 'Choice_%_1:City of Portland, Councilor, District %:%:Number of Winners 3:%:NON' THEN 
            split_part(split_part(column_name, ':', 5), ':', 1)
          ELSE NULL 
        END AS candidate_name,
        CASE 
          WHEN column_name LIKE 'Choice_%_1:City of Portland, Councilor, District %:%:Number of Winners 3:%:NON' THEN 
            TRY_CAST(split_part(column_name, ':', 3) AS INTEGER)
          ELSE NULL 
        END AS rank_position
      FROM headers
    )
    SELECT p.column_name, c.candidate_id, p.candidate_name, p.rank_position
    FROM parsed p JOIN candidates c USING(candidate_name)
    WHERE p.candidate_name IS NOT NULL AND p.rank_position IS NOT NULL;
  `,

  createBallotsLongTable: `
    CREATE OR REPLACE TABLE ballots_long AS
    WITH unpivoted AS (__UNION_ALL_PLACEHOLDER__)
    SELECT u.BallotID, u.PrecinctID, u.BallotStyleID,
           cc.candidate_id, cc.candidate_name, cc.rank_position,
           CAST(u.has_vote AS BOOLEAN) AS has_vote
    FROM unpivoted u
    JOIN candidate_columns cc ON u.column_name = cc.column_name;
  `,

  getCompleteStats: `
    WITH ballots_stats AS (
      SELECT
        COUNT(*) AS rows,
        COUNT(DISTINCT BallotID) AS ballots,
        COUNT(DISTINCT candidate_id) AS candidates,
        MIN(rank_position) AS min_rank,
        MAX(rank_position) AS max_rank,
        (SELECT COUNT(*) FROM (SELECT BallotID FROM rcv_raw GROUP BY 1 HAVING COUNT(*)>1)) AS duplicate_ballots
      FROM ballots_long
    ),
    candidates_stats AS (
      SELECT COUNT(*) AS rows FROM candidates
    )
    SELECT 
      JSON_OBJECT(
        'candidates', JSON_OBJECT('rows', candidates_stats.rows),
        'ballots_long', JSON_OBJECT(
          'rows', ballots_stats.rows,
          'ballots', ballots_stats.ballots,
          'candidates', ballots_stats.candidates,
          'min_rank', ballots_stats.min_rank,
          'max_rank', ballots_stats.max_rank,
          'duplicate_ballots', ballots_stats.duplicate_ballots
        )
      ) AS result
    FROM ballots_stats, candidates_stats;
  `,

  exportCandidates: `COPY candidates TO 'data/ingest/candidates.parquet' (FORMAT 'parquet');`,

  exportBallotsLong: `COPY ballots_long TO 'data/ingest/ballots_long.parquet' (FORMAT 'parquet');`,
} as const;
