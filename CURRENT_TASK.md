Title

[Stage 0c] AppShell + shadcn Baseline (Header, Breadcrumbs, Share)

Context

Stages 0a–0b established a unified contracts manifest and static routes (/e, /e/[electionId], /e/[electionId]/c/[contestId]). Stage 0c adds a consistent UI frame so future slices can drop content into a stable layout. We’ll standardize on shadcn/ui primitives, implement a minimal AppShell (header/footer), breadcrumbs from the manifest, and a Share button that preserves ?v=<buildId>.

Scope

shadcn/ui + Tailwind setup


- Global layout
- app/layout.tsx: mount Tailwind globals and shadcn Provider(s) if needed
- components/AppShell.tsx: header, content slot, footer.
- Header (shadcn): brand button → /, nav links → /e, /learn (placeholder), /about (placeholder).
- share button at header-right (copies window.location.href, shows toast “Link copied”).
- app/(marketing)/page.tsx, /e, and deeper pages should render within AppShell.
- Breadcrumbs (route-aware)

Logic:

/e → Elections

/e/{electionId} → Elections › {election.name}

/e/{electionId}/c/{contestId} → Elections › {election.name} › {contest.name}

Read names from the contracts manifest already loaded at build time (no network). For pages that can’t resolve a name, show the ID.

Param preservation

lib/url-preserve.ts: withPreservedQuery(href: string, keys = ["v"]): string that merges current URL’s ?v when building links.

Use it for all internal Link elements rendered by the AppShell/Breadcrumbs (so share pins survive navigation).

UX for errors/404

app/not-found.tsx: shadcn Alert with link back to /e.

app/error.tsx: shadcn Alert with minimal stack hint in dev.

Visual placeholders

Replace plain HTML in /e, /e/[electionId], /e/[electionId]/c/[contestId] with shadcn Card wrappers and headings (no charts).

Keep copy minimal; this is just scaffolding.

Guardrails

- No data artifact reads (Parquet/JSON) in this stage—manifest only.
- No charts/visualizations yet; placeholders only.
- Single source of truth: all names/IDs come from packages/contracts/lib/manifest (schema + loader).
- Preserve ?v in all internal links rendered by these components.
- Keep changes additive; do not refactor /demo/* or pipeline code.
- Follow repo rules: contract-first, absolute imports, commit frequently.

Done When

- All pages render within AppShell using shadcn primitives.
- Breadcrumbs show correct labels for election/contest based on manifest.
- The Share button copies the exact current URL (including any ?v=) and confirms via toast.
- Navigation links (header + breadcrumbs) preserve ?v.
- /e, election, and contest pages display clean shadcn Card placeholders (no unstyled HTML).
- 404 and error pages render shadcn Alert with a working link to /e.

Output

commits adding/updating:
- app/layout.tsx (providers + shell mount)
- components/AppShell.tsx, components/Breadcrumbs.tsx, components/ShareLink.tsx
- lib/url-preserve.ts
- app/not-found.tsx, app/error.tsx
- Replace markup in: app/e/page.tsx, app/e/[electionId]/page.tsx, app/e/[electionId]/c/[contestId]/page.tsx with shadcn Card placeholders

Short NOTES in describing:
- how breadcrumbs resolve names from the manifest
- how withPreservedQuery() is used
