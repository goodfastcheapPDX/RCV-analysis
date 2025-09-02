Title: Implement Rank Distribution Visualization (horizontal bars) + Storybook with goldens & edge cases
Context (spec packet)

Per-candidate page scaffold exists at /e/[electionId]/c/[contestId]/cand/[candidateId].

Slice rank_distribution_by_candidate provides rows:
{ election_id, contest_id, candidate_id, rank, count, pct_all_ballots, pct_among_rankers }.

Charting/UI: Recharts + shadcn/ui. Prefer horizontal bars (rank on Y, percent on X).

Add Storybook stories to visualize:

“Golden” (real artifact rows for a known contest/candidate).

Hand-coded fixtures for critical cases (zero-rank, sparse ranks, skewed tails).

Scope

Data access (UI)

src/lib/slices/rankDistribution.ts

loadRankDistribution(eid, cid): Promise<Row[]>

selectCandidateRankDistribution(rows, candidateId): Row[]

Lightweight Zod guard mirroring the slice output; log + throw typed error on mismatch.

Manifest lookup by sliceKey="rank_distribution_by_candidate"; if no artifact, return a typed error { code:"MISSING_ARTIFACT" }.

Chart component

components/candidate/RankDistributionCard.tsx

Recharts <ResponsiveContainer><BarChart layout="vertical">.

YAxis: rank (1..max).

XAxis: percentage (0..1; % formatter).

Toggle (shadcn) for metric: pct_all_ballots (default) vs pct_among_rankers.

Tooltip: rank, count, both percentages.

Empty state: when all counts = 0.

Loading: shadcn Skeleton.

Error: “Data unavailable” with Retry button (re-calls loader).

Storybook

New story file: components/candidate/RankDistributionCard.stories.tsx

Stories:

Golden/HappyPath: Loads real rows from a dev fixture loader (see #4).

Edge_ZeroRank: All counts 0; chart shows empty state.

Edge_SparseRanks: Only ranks {1,3,5} present; ensure gaps render correctly in order 1..max.

Edge_SkewedHead: 1st-rank heavy distribution (tests axis scaling).

Edge_SkewedTail: Higher ranks dominate (tests legibility on small values at rank=1).

ToggleModes: Preloads same data and initializes in “% among rankers”.

Loading: Simulated delay with skeleton.

Error: Simulated loader throw (missing artifact).

Controls/Args:

metric: "pct_all_ballots" | "pct_among_rankers" (default "pct_all_ballots").

maxRank (optional override to stress axis).

candidateName (for aria-label/title).

Decorators:

withContainer to constrain width/height.

Optional theme decorator to match app tokens.

Golden plumbing for stories

Add a small dev-only helper under /.storybook/fixtures/:

rankDistribution.dev.fixture.ts exposing:

loadGolden(eid, cid, candidateId): Promise<Row[]> (reads local Parquet/JSON test fixture or a trimmed JSON snapshot exported during build).

handCoded(fixtype: 'ZeroRank'|'Sparse'|'SkewHead'|'SkewTail'|'HappyPath'): Row[]

Keep no cross-env coupling: the golden used by Storybook is a small JSON snapshot, not the full Parquet, to keep stories instant.

Add a script pnpm fixtures:rankdist that exports a minimal JSON for one known (eid,cid,candidateId) from Parquet into .storybook/fixtures/rankdist.golden.json. (This script is dev-only; not part of runtime.)

Accessibility & responsiveness

aria-label="Rank distribution bar chart for {candidateName}".

Live region below chart that updates with selected metric name.

Minimum heights: desktop min-h-[280px], mobile min-h-[220px].

Keyboardable toggle; tooltip content summarized in accessible text (counts + selected metric value for focused bar, if feasible).

Performance

Memoize filtered candidate rows and computed max_rank.

Do not prefetch all charts—the page loads only the contest-level artifact and filters for the current candidate.

Tests

Unit (lib): selection + sorting, zero-rank detection, Zod guard rejects malformed rows.

Component: default renders horizontal bars; toggle switches metric; empty, loading, and error states.

Integration (page): visiting /cand/{candidateId}?tab=rank shows chart from a seeded manifest/artifact stub.

Storybook smoke: stories mount without errors (CI storyshots optional).

Guardrails

Do not modify slice compute/artifacts.

No new API routes; manifest/file reads only.

Keep Storybook fixtures tiny and checked in (JSON), not large Parquet blobs.

No global styling or theming refactors; scope to the card.

Done When

Candidate Rank tab renders horizontal bar chart with metric toggle and proper states.

Storybook shows:

Golden/HappyPath (from JSON snapshot),

ZeroRank, SparseRanks, SkewedHead, SkewedTail, ToggleModes, Loading, Error.

All tests pass (unit, component, integration); Storybook stories mount cleanly.

Output

PR including:

src/lib/slices/rankDistribution.ts (loader + selectors + Zod guard)

components/candidate/RankDistributionCard.tsx (chart, toggle, states)

components/candidate/RankDistributionCard.stories.tsx

Tests under tests/ui/candidate-page/rank-distribution/*

PR summary (3–5 lines) covering: Recharts horizontal bar viz, Storybook goldens + edge cases, defensive row validation, and resilient loading/error handling.