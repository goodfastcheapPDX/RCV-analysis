Stage 0 — App Skeleton & Contracts (foundation)

Goal: Ship a navigable shell that validates params and loads prebaked artifacts.

Routes: /e, /e/{electionId}, /e/{electionId}/c/{contestId}

Infra:

manifest.json with { buildId, elections:[{id, contests:[{id, seats}]}] }

Zod URL param schemas per page (round/compare/etc. parsers in lib/url-state.ts)

generateStaticParams() from manifest.json

Contract enforcer wiring (CLAUDE.md rules) available to pages

UI: Basic header, breadcrumbs, Share button (copies full URL with ?v=).

Done When: All three routes statically render; unknown IDs 404; ?v= pin recognized.

Stage 1 — Election Dashboard (single page)

Goal: Shareable overview page.

Route: /e/{electionId}

Artifacts: election-summary.json (winners, seats, turnout, first-choice bars)

UI: Summary cards + first-choice bar chart; “Go to contests” list.

Validation: Output schema via Zod; page fails closed if invalid.

Done When: Page loads purely from static JSON; links to each contest work.

Stage 2 — Round Stepper (transfers MVP)

Goal: Traversable, linkable STV rounds for one contest.

Route: /e/{electionId}/c/{contestId}/transfers?round=&show=&highlight=&v=

Artifacts: stv-tabulation.json (per-round tallies + events), stv_meta.json

UI:

Stepper (Prev/Next), round table (votes, Δ, quota, exhausted)

Elected/Eliminated badges; optional show=quota,exhausted

Testing: Conservation invariant; round count ≥ 1; final winners match summary.

Done When: Deep link like …/transfers?round=7&show=quota reproduces exact state.

Stage 3 — Candidates (list + detail)

Goal: Per-candidate deep links.

Routes:

List: /…/candidates?sort=first_choice|net_gains

Detail: /…/cand/{candidateId}?view=progression|affinity&compare=otherId

Artifacts: candidates/enhanced-list.json, candidates/{id}/profile.json

UI:

List table w/ sort; link to detail

Detail: progression sparkline + key stats; “Compare” control writes compare=

Done When: Copying any candidate URL reproduces the view (including compare).

Stage 4 — Ballot Explorer (patterns first, journeys optional)

Goal: Aggregate patterns with linkable filters; optional single-ballot panel.

Routes:

/…/ballots?startsWith=&len=&cluster=&journey=

Optional detail path: /…/ballots/{ballotId} → redirects to list with ?journey=

Artifacts: ballots/patterns.json (clusters, ranking depth), ballots/journeys.json (subset/sample)

UI: Pattern chips, histogram of ranking length, table of common sequences; side panel for a journey if journey set.

Guards: No raw PII; cap journey samples.

Done When: Filters (e.g., startsWith=kim&len=>=3) persist solely in URL.

Stage 5 — Coalition Explorer (network MVP)

Goal: First useful network with stable links.

Route: /…/coalitions?metric=affinity|transfer_eff&focus=&threshold=&layout=force|circle

Artifacts: coalition-network.json (nodes+edges with weights)

UI: Force layout; slider for threshold; click node sets focus=.

Validation: Edge weights ∈ [0,1]; no self-loops; connected-components count tracked.

Done When: A copied URL reproduces the same network state & threshold.

Stage 6 — Methods & Validation (trust)

Goal: Visible math & audits.

Route: /…/methods?section=quota|conservation|drift

Artifacts: Golden micro results, compare output

UI: Tabs with explanations, invariant checks (green checks + counts).

Dev: /_dev/compare?slice= and CLI compare.

Done When: At least one invariant visibly passes on live data; drift tool works.

Stage 7 — Product polish (shareability & perf)

Goal: Make links rich and fast.

SEO/OG: generateMetadata() per page; OG image for round snapshots.

Perf: Preload next likely route (e.g., from contest → transfers round 1).

Sitemaps: Enumerate /e, all elections/contests; canonical on ?v=.

Done When: Slack/Discord unfurls look correct; lighthouse acceptable.

Parallel tracks you can run anytime

Data contracts: Zod schemas per artifact; contract enforcer in compute.

Golden datasets: Hand-verifiable STV cases; parity with official JSON.

Testing: Conservation, quota, no negative deltas, checksum pins.