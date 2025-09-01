Title: Add per-candidate page scaffold + routing (rank distribution placeholder)
Context (spec packet)

Multi-election routes exist at /e/[electionId]/c/[contestId] with first-choice + STV visualizations.

We need a canonical page per candidate to host upcoming visuals (starting with rank-distribution).

Contracts-first policy: no changes to compute/artifacts in this task; consume what exists.

Decisions (to unblock):

candidateId format: use the existing candidate_id value from artifacts as the canonical string id in URLs (cast numerics to strings).

Slug policy: skip slug support for now - deal directly with canonical candidate IDs until it becomes necessary.

Badge logic:

“Elected” if candidate appears in STV meta as elected for this (electionId, contestId).

“Eliminated” if present in any elimination event.

If neither, show no status badge.

Tab persistence: keep ?tab=rank (default) in the query string; when navigating between candidates within the same contest, preserve the current tab value; when moving to a different contest or election, reset to default (rank).

Scope

Routing

New route: /e/[electionId]/c/[contestId]/cand/[candidateId].

On load:

Detect if the param matches a known candidate_id (string compare).

If no match → render Not Found.

Canonical URL shape:
/e/{eid}/c/{cid}/cand/{candidateId}?tab=rank

Data access (read-only)

Use existing manifest lookups to obtain:

Contest candidates list (id, display_name at minimum).

STV meta/rounds for badge derivation (elected vs eliminated).

Skip utils layer for now - implement candidate lookup and badge logic directly in the page component until complexity requires abstraction.

No new fetch endpoints; use whatever manifest/file helpers already exist. If candidates live in Parquet, call the existing data loader that reads it (or temporary manifest cache if present).

Page shell

Server component page renders:

Header with candidate name + badge chip (elected / eliminated / none).

Breadcrumbs: Election › Contest › Candidate.

Local tabs (client component): Overview (stub), Rank distribution (default), Rounds (stub).

RankDistributionCard placeholder component:

Clear explanatory text stating this is a placeholder for the upcoming rank distribution visualization.

Expected data contract documentation: { rank: number; count: number; pct_all_ballots: number; pct_among_rankers: number }[]

NO VISUALIZATION IMPLEMENTATION - this task only creates the placeholder, not the actual chart/bars.

Navigation wiring

Make candidate labels in first-choice and STV rounds views link to the new page:

Preserve ?tab when staying within same contest; otherwise omit.

Use the canonical candidate ID in URLs.

Provide a “Back to contest” link in page header secondary actions.

404 / validation

Validate candidate existence within the (electionId, contestId) scope (not globally).

Unknown candidate → friendly Not Found with link back to contest page.

UX polish

Responsive layout; chart container with sensible min-height.

Tooltip “What is rank distribution?” short explainer.

“Data source” chip showing slice key it will use later: rank_distribution_by_candidate.

Tests

Route resolution:

valid candidate id → renders candidate header.

unknown candidate id → Not Found.

Badge logic unit test with a tiny in-memory STV meta fixture.

Link integration:

First-choice table candidate name points to canonical URL.

STV rounds candidate link points to canonical URL.

Tab persistence across candidate nav within same contest.

Guardrails

No data-pipeline changes (no new artifacts, no compute).

No API routes; use existing file/manifest loaders.

No refactors outside: new route folder, minimal link wrappers in existing views, shared nav/breadcrumb components.

Absolute imports only.

Keep changes small; no visual chart implementation here.

Done When

Visiting /e/{eid}/c/{cid}/cand/{candidateId} renders header, breadcrumbs, tabs, and rank-distribution placeholder.

First-choice + STV views link correctly to the canonical candidate page.

Not Found renders for invalid candidate within the contest.

Tests pass for routing, badge logic, 404, and link wiring (no slug tests needed).

No changes to compute or artifacts.

Output

PR including:

app/e/[electionId]/c/[contestId]/cand/[candidateId]/page.tsx (server)

components/candidate/Tabs.tsx (client) and components/candidate/RankDistributionCard.tsx

Minimal updates to first-choice & STV components to wrap names with links

Tests under tests/ui/candidate-page/*

PR summary (3–5 lines) describing:

Canonical URL shape (candidate ID only, no slug support)

Badge derivation source (STV meta)

Tab persistence rules

What's stubbed (rank distribution viz) vs complete (routing + scaffold)