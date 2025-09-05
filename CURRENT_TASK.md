Title: Build slice <candidate_affinity_matrix> end-to-end

Context:

Inputs: normalized ballots_long.parquet (BallotID, candidate_id, rank)

Goal: measure how often pairs of candidates co-occur on the same ballot, regardless of order.

Output will support heatmaps and coalition network graphs.

Scope:

Contract (index.contract.ts)

Output schema:
```typescript
const Output = z.object({
  candidate_a: z.string(),       // canonical: a < b lexicographically
  candidate_b: z.string(),
  cooccurrence_count: z.number().int().nonnegative(),
  cooccurrence_frac: z.number().min(0).max(1) // count / total_ballots_with_any_rank
});

const Stats = z.object({
  total_ballots_considered: z.number().int().positive(),
  unique_pairs: z.number().int().nonnegative(),
  max_pair_frac: z.number().min(0).max(1),
  compute_ms: z.number().int().nonnegative()
});
```

version: 0.1.0  // start pre-1.0 while we iterate on normalization later

Compute (compute.ts)

Data validation:
- Include ballots with incomplete rankings: co-occurrence counts when both candidates have explicit ranks on the same ballot (any ranks 1–N)
- Per-ballot dedup: Guard against duplicates by deduping (ballot_id, candidate_id) before pair generation
- No imputation for "unranked" candidates

Pairing strategy:
- Canonical pairs only: Store one row per unordered pair using lexicographic ordering (candidate_a < candidate_b)
- This prevents double storage and keeps artifacts smaller

SQL implementation:
```sql
-- CTE 1: ballots with any valid ranking, deduped
WITH ranked AS (
  SELECT ballot_id, candidate_id
  FROM ballots_long
  WHERE rank IS NOT NULL
  GROUP BY ballot_id, candidate_id  -- dedup
),
-- CTE 2: total ballot count
tot AS (
  SELECT COUNT(DISTINCT ballot_id) AS total_ballots
  FROM ranked
),
-- CTE 3: generate canonical pairs
pairs AS (
  SELECT a.candidate_id AS candidate_a,
         b.candidate_id AS candidate_b,
         COUNT(*) AS cooccurrence_count
  FROM ranked a
  JOIN ranked b
    ON a.ballot_id = b.ballot_id
   AND a.candidate_id < b.candidate_id   -- canonical unordered pair
  GROUP BY 1,2
)
SELECT p.candidate_a, p.candidate_b, p.cooccurrence_count,
       p.cooccurrence_count::DOUBLE / t.total_ballots AS cooccurrence_frac
FROM pairs p CROSS JOIN tot t;
```

Performance logging:
- Time the compute pipeline and persist compute_ms in manifest stats
- Console info: input rows, dedup rows, pairs rows, aggregate pairs rows
- 60s cap is per election/contest artifact compute on a laptop

Export Arrow artifact (content-hashed).
Update manifest entry with Stats.

View (view.tsx)

Route: `/e/[electionId]/c/[contestId]/coalitions/affinity`

Visualization: @nivo/heatmap SVG component
- Heatmap matrix (candidate vs candidate) colored by cooccurrence_frac
- Diagonal cells: Always exclude self-pairs from data; render diagonal as grayed/disabled cells with tooltip "self-pair excluded"
- Candidate ordering: Default sort candidates by first-choice total desc (stable + interpretable)
- Hover tooltip: candidate A, candidate B, cooccurrence_count, cooccurrence_frac (with denominator = total_ballots_considered)

Controls (progressive enhancement):
- Minimum co-occurrence fraction threshold slider (default off) - client-side filtering
- Top-K pairs toggle (e.g., keep top 100 pair weights) for large candidate slates
- Start with basic heatmap, add filters as advanced options

Storybook (candidate_affinity_matrix.story.tsx)

Stories:
1. Default view with live vs static toggle
2. Threshold slider story (threshold=0.01)  
3. Top-K pairs story (top-K=100)
4. Example highlighting strongest and weakest affinities

Tests:

Contract conformance:
- All rows conform to Output schema
- All stats conform to Stats schema

Canonical order invariant:
- Every row satisfies candidate_a < candidate_b lexicographically
- No self pairs: assert no candidate_a == candidate_b

Symmetry by reconstruction:
- Materialize a mirrored matrix in test and check M[a,b] == M[b,a]
- This validates that canonical storage produces symmetric results when reconstructed

Conservation bounds:
- 0 ≤ cooccurrence_frac ≤ 1 for all rows
- max_pair_frac ≤ 1 in stats
- cooccurrence_count ≤ total_ballots_considered for all rows

Edge cases:
- Single-candidate ballots → produce no pairs but correct total_ballots_considered
- All-candidate ballots → ensure pair count equals C(n,2) 
- Mixed-depth ballots (ranks 1–6, some with only 1–2 ranks) → fractions line up with hand-computed golden dataset

Guardrails:

Scope limitations:
- Do not implement clustering or network centrality yet — that's a separate coalition_network slice
- Do not implement Jaccard/Lift normalization — that's a future candidate_affinity_normalized slice  
- Keep this slice to raw co-occurrence counts and fractions only

Performance:
- Accept O(n²) per ballot if needed, unless >60s compute
- Expected volume: ≤6 ranks per ballot → max 15 pairs per ballot → ~4.5M pair rows pre-aggregation for 300k ballots (very manageable)
- Add detailed logging for SQL steps to identify bottlenecks early

Input validation:
- Use only validated ballots_long as input
- Rely on existing ingest validation; this slice dedups and rejects NULL ranks

Done When:

- npm run build:data:all creates artifact and updates manifest
- Storybook heatmap shows expected Live vs Static match with @nivo/heatmap
- All tests green: contract conformance, canonical order, symmetry reconstruction, conservation bounds, edge cases
- Performance logging shows compute_ms under 60s threshold

Output:

- PR diff with new slice folder, manifest entry, and Storybook stories
- Short summary of affinity calculation assumptions and canonical pair storage strategy

Future slices:
- candidate_affinity_normalized: add Jaccard and Lift (mitigates popularity bias)
- candidate_affinity_rank_conditioned: anchor on rank=1 (and optionally rank=6) to profile cores vs tails  
- coalition_network: build graph from normalized scores + clustering + centrality