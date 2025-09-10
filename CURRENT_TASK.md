Title: Build slice <candidate_affinity_proximity> end-to-end

Context (spec packet):

Purpose: emphasize ballot pairs that appear near each other in rank order (e.g., A@1 with B@2 counts more than A@1 with B@6).

Input: ballots_long.parquet { ballot_id, candidate_id, rank_position } (one row per ranked placement).

Definition (first pass): per ballot, if A and B both appear with ranks rA, rB, define distance d = |rA - rB| (∈ {1..5}). Weight for that ballot = α^(d-1) with α = 0.5 (constant in this slice).

Adjacent ranks (d=1) contribute 1.0; two apart 0.5; three apart 0.25; …

Output: a raw proximity score per unordered pair (no normalization yet).

App placement:

New route: /e/[electionId]/c/[contestId]/coalitions/proximity

Component files:

src/features/coalitions/proximity/ProximityHeatmap.tsx

src/features/coalitions/proximity/useProximityData.ts

Manifest key: slices.candidate_affinity_proximity with artifact under
data/{env}/{electionId}/{contestId}/candidate_affinity_proximity/affinity.arrow

Sidebar/nav: Contest → Coalitions → “Proximity-weighted” (sibling of Raw + Jaccard).

Scope
1) Contract (index.contract.ts)
// version: 0.1.0
export const Output = z.object({
  candidate_a: z.number().int(),             // canonical: a < b
  candidate_b: z.number().int(),
  weight_sum: z.number().nonnegative(),      // Σ α^(|rA-rB|-1)
  pair_count: z.number().int().nonnegative(),// ballots with both present
  avg_distance: z.number().nonnegative(),    // AVG(|rA - rB|)
});

export const Stats = z.object({
  total_ballots_considered: z.number().int().positive(),
  unique_pairs: z.number().int().nonnegative(),
  alpha: z.number().nonnegative(),           // = 0.5
  max_weight_sum: z.number().nonnegative(),
  compute_ms: z.number().int().nonnegative(),
});

2) Compute (compute.ts)

Filter rank_position IS NOT NULL, dedup (ballot_id, candidate_id).

Self-join per ballot → pairs (a.candidate_id < b.candidate_id).

Compute:

distance = ABS(a.rank_position - b.rank_position)

w = POWER(:alpha, distance - 1) with α=0.5

Aggregate: weight_sum = SUM(w), pair_count = COUNT(*), avg_distance = AVG(distance).

Stats: total ballots, unique pairs, alpha, max weight, compute_ms.

Validate rows via Zod before export.

3) View (view.tsx)

Page at /coalitions/proximity.

Heatmap with value=weight_sum.

Controls: threshold slider (0–max), Top-K pairs toggle, α=0.5 chip.

Tooltip: weight_sum, pair_count, avg_distance, formula hint.

Axis ordering: first-choice totals.

4) Storybook

Stories: default, threshold=10th percentile, Top-K=100.

Live vs Static compare.

5) Tests

Contract conformance, canonical ordering, no self-pairs.

Bounds: 1 ≤ avg_distance ≤ 5; weight_sum ≤ pair_count.

Totals parity with raw/Jaccard.

Edge cases: single-rank ballots (counted, no pairs), all-candidate ballots.

Guardrails

No normalization yet.

α is fixed (0.5).

Don’t touch existing raw/Jaccard slices.

≤60s per contest; log diagnostics if exceeded.

Done When

pnpm build:data produces artifact + manifest.

View renders heatmap at /coalitions/proximity.

Storybook Live vs Static is green.

Tests pass.

Output

PR with new slice folder, route, story, tests, manifest entry, and README note on formula.