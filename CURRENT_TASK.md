Title: Implement CSV→DuckDB ingestion + normalization as slice `ingest_cvr` (uses COPY … FORMAT ARROW)

You are implementing ONE vertical slice end-to-end. Do not modify unrelated files. If blocked, STOP and print a diagnostic + next step.

The relevant file is `data/2024-11/canonical/district-2-cast-vote-record.csv`

Context (spec packet):
- Source CSV (immutable) has:
  - Identifiers: BallotID, PrecinctID, BallotStyleID
  - Status: Status (0 = valid; exclude non-zero)
  - Candidate choice columns named "<CandidateName> - Rank <N>" with 0/1 values.
- Target long table schema (ballots_long):
  BallotID TEXT,
  PrecinctID TEXT NULL,
  BallotStyleID TEXT NULL,
  candidate_id INT,
  candidate_name TEXT,
  rank_position INT,
  has_vote BOOLEAN
- Auxiliary tables:
  candidates(candidate_id INT PK, candidate_name TEXT UNIQUE)
  candidate_columns(column_name TEXT, candidate_id INT, candidate_name TEXT, rank_position INT)
- Validation invariants:
  - Exclude Status != 0
  - (BallotID, candidate_id, rank_position) unique
  - rank_position ≥ 1; warn if max_rank > 10
  - has_vote = TRUE in ballots_long rows only
- Golden micro CSV (for tests): tests/golden/micro/cvr_small.csv
  Expected: ballots=12, candidates=5, min_rank=1, max_rank=3, total_vote_records=28

Scope:
1) Create `src/packages/contracts/slices/ingest_cvr/index.contract.ts`
   - Output zod schema:
     {
       candidates: { rows:int },
       ballots_long: {
         rows:int, ballots:int, candidates:int, min_rank:int, max_rank:int, duplicate_ballots:int
       }
     }
   - version: 1.0.0
   - Provide SQL strings for each stage (see below).

2) Implement `src/packages/contracts/slices/ingest_cvr/compute.ts` (Node + duckdb/node-api):
   - Create DB at `data/working/election.duckdb` if missing.
   - Run all SQL in a transaction:
     a) Load raw:
        CREATE OR REPLACE TABLE rcv_raw AS
        SELECT * FROM read_csv('${process.env.SRC_CSV}', header=true, ignore_errors=true,
          columns={'BallotID':'VARCHAR','PrecinctID':'VARCHAR','BallotStyleID':'VARCHAR','Status':'INTEGER'});
     b) Derive headers → candidates/candidate_columns using regex:
        candidate_name = regexp_extract(column_name, '^(.*)\\s+-\\s+Rank\\s+(\\d+)$', 1)
        rank_position  = CAST(regexp_extract(column_name, 'Rank\\s+(\\d+)$', 1) AS INTEGER)
     c) Build ballots_long by UNION-ALL over candidate_columns where Status=0 and the column = 1.
   - **Export artifacts via DuckDB SQL COPY (NOT Node Arrow APIs):**
     COPY candidates    TO 'data/ingest/candidates.arrow'     (FORMAT 'arrow');
     COPY ballots_long  TO 'data/ingest/ballots_long.arrow'   (FORMAT 'arrow');
   - Compute stats and update `manifest.json` under key `ingest_cvr@1.0.0`:
     { files:[…], hashes, rows, min/max rank, duplicate_ballots, datasetVersion }

3) Tests (vitest) in `src/packages/contracts/slices/ingest_cvr/tests.spec.ts`:
   - Using env `SRC_CSV=tests/golden/micro/cvr_small.csv`
   - Assert exact counts (rows, ballots, candidates, min/max rank = 1/3, total_vote_records=28)
   - For one sample BallotID, assert ranks are ordered and unique.

Guardrails:
- Do NOT export JSON for artifacts; only Arrow via `COPY … (FORMAT 'arrow')`.
- Do NOT create extra tables beyond rcv_raw, candidates, candidate_columns, ballots_long.
- If header pattern mismatches, STOP and print a list of offending columns.
- Keep compute ≤ 60s; if slower, STOP and report which step is slow.

Done When:
- `pnpm build:data` writes:
  - data/ingest/candidates.arrow
  - data/ingest/ballots_long.arrow
- `manifest.json` contains `ingest_cvr@1.0.0` with populated stats.
- Storybook Live vs Static is green on the golden CSV.
- Tests pass.

Key SQL snippets to use (adapt/compose as needed):
-- headers
WITH headers AS (
  SELECT column_name
  FROM duckdb_columns
  WHERE table_name='rcv_raw'
    AND column_name NOT IN ('BallotID','PrecinctID','BallotStyleID','Status')
),
parsed AS (
  SELECT
    column_name,
    regexp_extract(column_name,'^(.*)\\s+-\\s+Rank\\s+(\\d+)$',1) AS candidate_name,
    CAST(regexp_extract(column_name,'Rank\\s+(\\d+)$',1) AS INTEGER) AS rank_position
  FROM headers
)
CREATE OR REPLACE TABLE candidates AS
SELECT ROW_NUMBER() OVER (ORDER BY candidate_name) AS candidate_id, candidate_name
FROM (SELECT DISTINCT candidate_name FROM parsed WHERE candidate_name IS NOT NULL);
CREATE OR REPLACE TABLE candidate_columns AS
SELECT p.column_name, c.candidate_id, p.candidate_name, p.rank_position
FROM parsed p JOIN candidates c USING(candidate_name)
WHERE p.candidate_name IS NOT NULL AND p.rank_position IS NOT NULL;

-- normalization (UNION-ALL block generated in TS for each column in candidate_columns)
CREATE OR REPLACE TABLE ballots_long AS
WITH unpivoted AS (
  /* INSERT GENERATED UNION-ALL:
     SELECT BallotID, PrecinctID, BallotStyleID, '<col>' AS column_name, CAST("<col>" AS INTEGER) AS has_vote
     FROM rcv_raw WHERE Status=0 AND "<col>"=1
     UNION ALL … */
)
SELECT u.BallotID, u.PrecinctID, u.BallotStyleID,
       cc.candidate_id, cc.candidate_name, cc.rank_position,
       CAST(u.has_vote AS BOOLEAN) AS has_vote
FROM unpivoted u
JOIN candidate_columns cc ON u.column_name = cc.column_name;

-- stats
SELECT
  COUNT(*) AS total_vote_records,
  COUNT(DISTINCT BallotID) AS ballots_with_votes,
  COUNT(DISTINCT candidate_id) AS candidates_receiving_votes,
  MIN(rank_position) AS min_rank,
  MAX(rank_position) AS max_rank,
  (SELECT COUNT(*) FROM (SELECT BallotID FROM rcv_raw GROUP BY 1 HAVING COUNT(*)>1)) AS duplicate_ballots
FROM ballots_long;

Output:
- PR diff, commands to run locally:
  SRC_CSV=tests/golden/micro/cvr_small.csv pnpm build:data
  pnpm test -w src/packages/contracts
  pnpm storybook
- A 5-line note explaining header parsing assumptions and any edge cases encountered.