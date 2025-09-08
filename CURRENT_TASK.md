Title: Build slice <candidate_affinity_jaccard> end-to-end

Context (spec packet):
	•	We already have a raw pairwise co-occurrence slice (candidate_affinity_matrix) that counts |A∧B|.
	•	Jaccard normalizes pairwise affinity to discount “big candidate” popularity effects:
J(A,B)=\frac{|A\wedge B|}{|A\cup B|}=\frac{|A\wedge B|}{|A|+|B|-|A\wedge B|}
	•	Inputs: ballots_long.parquet with {ballot_id, candidate_id, rank}.
	•	Output powers a heatmap + (later) clusterable network.

⸻

Scope

1) Contract (index.contract.ts)

// version: 0.1.0  (pre-1.0 while we harden definitions)
export const Output = z.object({
  candidate_a: z.number().int().positive(),       // canonical: a < b numerically
  candidate_b: z.number().int().positive(),
  pair_count: z.number().int().nonnegative(),     // |A∧B|
  presence_a: z.number().int().nonnegative(),     // |A|
  presence_b: z.number().int().nonnegative(),     // |B|
  union_count: z.number().int().nonnegative(),    // |A| + |B| - |A∧B|
  jaccard: z.number().min(0).max(1),              // pair_count / union_count (0 if union_count=0)
})
  .refine((data) => data.candidate_a !== data.candidate_b, {
    message: "Self pairs are not allowed: candidate_a must not equal candidate_b",
  })
  .refine((data) => data.candidate_a < data.candidate_b, {
    message: "Canonical ordering required: candidate_a must be less than candidate_b",
  })
  .refine((data) => data.pair_count <= data.union_count, {
    message: "pair_count must not exceed union_count",
  });

export const Stats = z.object({
  total_ballots_considered: z.number().int().positive(),
  unique_pairs: z.number().int().nonnegative(),
  max_jaccard: z.number().min(0).max(1),
  zero_union_pairs: z.number().int().nonnegative(), // should be 0 in practice
  compute_ms: z.number().int().nonnegative(),
});

2) Compute (compute.ts)
	•	Read ballots_long and dedup (ballot_id, candidate_id); exclude rank_position IS NULL.
	•	Compute per-candidate presence:

pres AS (SELECT candidate_id, COUNT(DISTINCT ballot_id) AS presence FROM ranked GROUP BY 1)


	•	Compute unique unordered pairs per ballot (canonical a.candidate_id < b.candidate_id), aggregate to pair_count.
	•	Join pairs with pres twice to get presence_a, presence_b.
	•	Compute union_count = presence_a + presence_b - pair_count.
	•	Compute jaccard = CASE WHEN union_count>0 THEN pair_count*1.0/union_count ELSE 0 END.
	•	Capture total_ballots_considered = COUNT(DISTINCT ballot_id) from ranked.
	•	Validate with contract enforcer (assertTableColumns, parseAllRows), derive Stats from parsed rows, write Arrow artifact (content-hashed), update manifest.

DuckDB SQL sketch

WITH ranked AS (
  SELECT ballot_id, candidate_id
  FROM ballots_long
  WHERE rank_position IS NOT NULL
  GROUP BY ballot_id, candidate_id
),
tot AS (
  SELECT COUNT(DISTINCT ballot_id) AS total_ballots FROM ranked
),
pres AS (
  SELECT candidate_id, COUNT(DISTINCT ballot_id) AS presence
  FROM ranked GROUP BY 1
),
pairs AS (
  SELECT a.candidate_id AS candidate_a,
         b.candidate_id AS candidate_b,
         COUNT(*) AS pair_count
  FROM ranked a
  JOIN ranked b
    ON a.ballot_id = b.ballot_id
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

	•	Perf logging: log input rows, dedup rows, pair rows pre-agg, unique_pairs, and wall-clock compute_ms (persist in Stats).

3) View (view.tsx)
	•	New route: src/app/e/[electionId]/c/[contestId]/coalitions/jaccard.
	•	Heatmap (value = jaccard). Diagonal grayed/disabled.
	•	Controls:
	•	Metric toggle (future-proof): Jaccard (active) | Raw (loads other slice; optional if you want now).
	•	Threshold slider on jaccard (default 0).
	•	Top-K pairs or min-degree filter for readability.
	•	Tooltip: A ↔ B, jaccard (pct), pair_count, union_count, presence_a, presence_b.

4) Storybook
	•	Stories:
	•	Default (no threshold).
	•	Threshold = 0.05.
	•	Top-K = 100.
	•	Optional comparison story that shows Raw vs Jaccard side-by-side for the same contest (read both artifacts).

5) Tests
	•	Contract conformance for all rows.
	•	Canonical ordering invariant: candidate_a < candidate_b.
	•	No self pairs present.
	•	Bounds: 0 ≤ jaccard ≤ 1, pair_count ≤ union_count, union_count = presence_a + presence_b - pair_count.
	•	Symmetry by reconstruction: build a mirrored matrix in test and assert J[a,b]==J[b,a] (within epsilon tolerance 1e-12).
	•	Denominator sanity: presence_* ≤ total_ballots_considered; pair_count ≤ MIN(presence_a, presence_b).
	•	Edge cases:
	•	Single-candidate ballots → no output rows; Stats still report ballots.
	•	“All-candidate” ballots (golden) → J[a,b]= pair/union matches hand calc.
	•	Mixed depth ballots (1–6 ranks) → spot-check a few pairs vs hand calc.

⸻

Guardrails
	•	Do not modify the raw co-occurrence slice or its manifest entry.
	•	No clustering/centrality here; that’s coalition_network later.
	•	Compute budget: keep ≤ 60s per contest; if exceeded, stop and print diagnostic (ballot count, pair cardinality).
	•	Arrow only; keep artifact under size budget. If needed, allow a percentile trim (manifest flag) but default to full matrix.

⸻

Done When
	•	npm run build:data produces candidate_affinity_jaccard artifact + manifest stats.
	•	Storybook Live vs Static compares cleanly.
	•	Tests green (contracts + invariants + edge cases).

⸻

Output
	•	PR with new slice folder, manifest additions, Storybook story, and a 5-line note on Jaccard assumptions (no rank conditioning; any-rank presence; canonical unordered pairs; no smoothing; no priors).

⸻

Notes on future extensibility
	•	Rank-conditioned Jaccard is a natural follow-up: compute presence and pairs on a filtered universe (e.g., ballots where A is rank=1).
	•	Lift and Cosine can be added in a sibling slice (candidate_affinity_normalized_alt) sharing the same singles/pairs compute pattern.
	•	If you later want to reuse the raw pairs artifact, add an opt-in code path: read pairs from artifact, recompute only pres from ballots_long, join, and assert counts match within tolerance. Keep the default path as above for simplicity.