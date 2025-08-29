Landing Page (Marketing) using shadcn

Context
0a–0c gave us manifest, routes, and AppShell. 0d adds a simple, credible homepage that funnels users into a specific election/contest and works well when shared.

Scope

app/(marketing)/page.tsx

Hero: app name + one-sentence mission

Two CTA cards:

“Explore Elections” → /e

“Jump to Demo” → /e/{electionId}/c/{contestId} (from manifest)

“How it works” blurb (CSV → static artifacts → interactive UI)

shadcn primitives only:

Card, Button, Separator, Alert, Tooltip (optional), Badge for “alpha”

Metadata & SEO

generateMetadata() with title/description

OG image placeholder (re-use public/og.png)

app/sitemap.ts include / (plus existing /e and children)

URL pin preservation

If ?v exists, preserve it in CTAs (use your withPreservedQuery() util)

No data reads beyond the contracts manifest

Guardrails

No charts or data fetches

Only shadcn primitives (keep visual language consistent)

Absolute imports; keep changes additive

Done When

/ renders hero + 2 CTAs styled with shadcn

CTAs preserve ?v when present

OG unfurl looks correct

Sitemap includes /

Output

PR adding/updating: (marketing)/page.tsx, metadata, sitemap tweak, OG image (if needed), small copy