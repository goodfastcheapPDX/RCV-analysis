Title: Add per-candidate page scaffold + routing (rank distribution placeholder)
Context (spec packet)

Multi-election app with routes like /e/[electionId]/c/[contestId] already rendering first-choice counts and STV round viz.

We need a canonical place for candidate-level visuals, starting with rank-distribution. This task adds the page, URL structure, layout, navigation, and link targets; the actual rank-distribution compute/fetch comes next.

Candidate identity comes from existing candidates artifact (id, name, party/label optional). Assume we can derive a stable candidateId and a slug.

Scope

Routing

Create route: /e/[electionId]/c/[contestId]/cand/[candidateId]

Accept either candidateId (preferred) or slug; if slug used, resolve to id and 301/replace URL to canonical candidateId.

Page shell

Server component page with a small loader that looks up candidate by id (or slug) from existing manifest/candidates artifact.

Page header: candidate display name, optional badge(s) (e.g., “Elected”, “Eliminated”), and election/contest chips.

Breadcrumbs: Election › Contest › Candidate.

Local nav / tabs

Tabs (client component): Overview (stub), Rank distribution (active), Rounds (stub).

Persist tab in URL: /cand/[candidateId]?tab=rank for deep-linking. Default to tab=rank.

Rank distribution placeholder

Insert a <RankDistributionCard> with:

Chart area placeholder stating “Rank distribution will render here once data slice is wired.”

Empty-state copy explaining what the chart will show (ranks 1..N and counts/percent).

A small contract note (e.g., expects { rank:int, count:int, pct:number }[]).

Include a dev-only toggle to show a tiny hardcoded mock (5–8 bars) to validate layout.

Link-in points

First-choice view: make candidate labels clickable to the new page (open in same tab).

STV rounds table: candidate names/badges link to this page.

(Optional) Add a “View candidate” link in any candidate tooltip/popover.

UX polish

Responsive layout; chart container maintains sensible min-height.

Copy + tooltip explaining “rank distribution” (educational tone).

Show a small “Data source” chip that will later reflect the connected slice key.

Errors / 404

If candidateId not found for the (electionId, contestId) pair, render Not Found with a link back to the contest page.

Tests

Route renders for a known (electionId, contestId, candidateId).

Breadcrumb and tab querystring persist after navigation.

First-choice and STV views contain links that point to the canonical candidate URL.

Guardrails

No data-pipeline or compute changes in this task. Do not add or modify SQL/Parquet/JSON artifacts.

No API routes. Consume only manifest/candidates already available to the frontend.

No refactors outside the new page, link wrappers, and minimal shared nav components.

Absolute imports only. Keep changes tightly scoped to routing and UI.

Done When

Navigating to /e/{eid}/c/{cid}/cand/{candidateId} renders the candidate page with header, breadcrumbs, tabs, and rank-distribution placeholder.

First-choice and STV views link correctly to this page for each candidate.

Unknown candidate produces a friendly 404 with a “Back to contest” link.

Basic tests for route render, link presence, and tab query persistence pass.

Output

PR with:

New route files under /app/e/[electionId]/c/[contestId]/cand/[candidateId]/page.tsx (+ client tab/nav + RankDistributionCard).

Small shared breadcrumb/tabs components if not already present.

Minimal updates to first-choice and STV components to wrap candidate labels with links.

Tests covering routing, links, and tab state.

A 3–5 line PR summary describing URL shape, link-in points, and what’s stubbed vs. coming next.