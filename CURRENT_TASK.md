Title: Build slice rank_distribution_by_candidate (contract-first, no UI)
Context (spec packet)

Multi-election/contest pipeline is live; artifacts are namespaced by (env)/(electionId)/(contestId)/….

We already produce: ingest_cvr (normalized ballots), first_choice_breakdown, and stv_rounds.

Goal: expose a chart-ready dataset that shows, for each candidate, how often they appear at each rank position (1..max_rank) in a given contest. This slice will drive a per-candidate “Rank distribution” view later.

Source of truth: ingest_cvr ballots_long.parquet table with columns: election_id, contest_id, BallotID, candidate_id, rank_position (int), has_vote (boolean). Only count rows where has_vote=TRUE. Use existing column names without normalization.

Scope

Contract

Create packages/contracts/slices/rank_distribution_by_candidate/index.contract.ts defining:

Output (Zod) rows:

{
  election_id: string,
  contest_id: string,
  candidate_id: number,         // use existing int type from ingest_cvr
  rank_position: number,        // 1..max_rank within contest (use existing column name)
  count: number,                // ballots that ranked this candidate at this exact rank (has_vote=TRUE only)
  pct_all_ballots: number,      // count / total_ballots_in_contest
  pct_among_rankers: number     // count / total_ballots_that_ranked_this_candidate_at_any_rank
}


Stats (Zod) sidecar on manifest entry:

{
  election_id: string,
  contest_id: string,
  max_rank: number,            // discovered from data
  total_ballots: number,       // distinct ballots in contest
  candidate_count: number,     // candidates in contest (incl. write-ins if present)
  zero_rank_candidates: number // candidates never ranked by any ballot
}


Version: 1.0.0.

Notes: percentages must be finite (0 ≤ pct ≤ 1) with deterministic rounding only at presentation; keep full-precision floats in artifact.

SQL (concept)

Inputs: normalized ingest_cvr table for the (election_id, contest_id) pair.

Steps (DuckDB CTEs):

contest_ballots — distinct BallotID in contest where has_vote=TRUE → total_ballots.

contest_candidates — distinct candidate_id in contest.

rank_rows — rows where has_vote=TRUE and rank_position is not null and 1 ≤ rank_position ≤ max_rank.

counts — SELECT candidate_id, rank_position, COUNT(DISTINCT BallotID) AS count FROM rank_rows.

rankers — per candidate: total ballots that ranked them at any rank (has_vote=TRUE).

joined — join counts + rankers + total_ballots to compute pct_all_ballots and pct_among_rankers.

(Required completeness) generate dense rank_position 1..max_rank per candidate and left join to yield zero-count rows (keeps chart axes aligned).

Output one table with all candidates × rank_positions (including zero-count rows).

Compute

Implement compute.ts in the slice folder:

Accept params (electionId, contestId); for static-first, materialize all candidates in this contest into a single artifact.

Use node-duckdb against existing Parquet artifacts from ingest_cvr.

Contract enforcement (MANDATORY, per CLAUDE rules):

assertTableColumns(conn, 'rank_distribution_tmp', OutputSchema)

parseAllRows(conn, 'rank_distribution_tmp', OutputSchema) (validate ALL rows)

Derive Stats from parsed rows (not raw SQL)

assertManifestSection(manifestPath, key, StatsSchema)

Write Parquet artifact with deterministic filename (content hash via sha256(filePath)), update manifest entry under:

data/{env}/{electionId}/{contestId}/rank_distribution/part-*.parquet


Manifest entry should include: version, stats, artifactPaths, and sliceKey: "rank_distribution_by_candidate".

Tests

Location: tests/slices/rank_distribution_by_candidate/.

Golden micro (hand-verifiable):

A 6–12 ballot contest with 3–5 candidates, max_rank = 4–6.

Include cases where:

A candidate is never ranked (tests zero-rank handling).

Some ballots skip intermediate ranks (e.g., rank 1 and 3 only).

Ties in popularity at a given rank.

Invariant tests:

count ≥ 0; rank_position ∈ [1, max_rank].

For each candidate: sum(count over rank_position) == ballots_that_ranked_candidate.

pct_all_ballots == count / total_ballots within float tolerance.

If a candidate has no rankers: they should still appear with rank_position 1..max_rank and all count=0, pct_* = 0, and be counted in zero_rank_candidates.

For any given rank_position r: sum(count over all candidates at r) ≤ total_ballots (strict < allowed due to under-ranking/invalids).

Schema test: ensure columns/types match Output exactly.

Docs / CHANGELOG

Append CHANGELOG entry with slice key, version, and brief description.

Update any slice index/readme if present to list this slice and its contract.

Guardrails

No UI or Storybook in this task.

Do not touch STV or first-choice SQL/compute.

No API routes; static artifact only.

No changes outside: new slice folder, manifest write, and tests.

Must keep compute ≤ 60s and artifact ≤ 50MB for typical contests; if exceeded, STOP and print diagnostic with proposed sharding.

Done When

pnpm build:data (or slice-specific command) produces the Parquet artifact(s) and updates manifest with sliceKey="rank_distribution_by_candidate" and Stats.

pnpm test passes, including golden + invariants + schema tests.

Validated rows via contract enforcer; manifests validated via assertManifestSection.

A sample contest shows expected totals (manual spot-check from golden).

Output

PR diff including:

packages/contracts/slices/rank_distribution_by_candidate/index.contract.ts

packages/contracts/slices/rank_distribution_by_candidate/compute.ts

tests/slices/rank_distribution_by_candidate/* (golden CSV/Parquet, tests)

CHANGELOG update

5-line PR summary:

Adds rank_distribution_by_candidate slice (v1.0.0).

Outputs candidate×rank counts + two normalized pcts.

Enforces contract on all rows; manifest stats derived from validated data.

Includes golden micro + invariants (zero-rank candidates, gaps, skipped ranks).

Precomputes one artifact per contest for static-first UI.