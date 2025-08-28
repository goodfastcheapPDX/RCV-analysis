Title

[Stage 0b] Routes: /e, /e/[electionId], /e/[electionId]/c/[contestId] via contracts manifest

Context

With Stage 0a, the unified contracts manifest and env-aware resolver exist in packages/contracts. Now we expose that structure as shareable, statically-generated routes with placeholders—no charts or shadcn yet. This sets up the URL-first IA described in the PRD and our vertical-slice approach.

Scope
	1.	Routes
	•	/e → Elections index (render list from manifest).
	•	/e/[electionId] → Election page (render election name + list of contests).
	•	/e/[electionId]/c/[contestId] → Contest page (render IDs + seats as placeholder).
	2.	Static generation
	•	Use loadManifestFromFs() (contracts package) in generateStaticParams() for election + contest routes.
	•	Use the same manifest in /e to render the list.
	3.	Query handling
	•	Plumb through optional ?v=<buildId>: read it, preserve it in internal links (no validation/pinning logic yet).
	4.	Errors
	•	not-found.tsx for unknown IDs.
	•	Friendly error if manifest is empty (link back to /e).
	5.	Types
	•	Only import types/schemas from packages/contracts/lib/manifest to keep a single source of truth.

Guardrails
	•	No UI library work yet (no shadcn)—plain placeholders are fine.
	•	No data reads beyond manifest; do not touch Parquet/JSON artifact files.
	•	No marketing/landing changes (that comes later).
	•	Absolute imports, commit frequently; fail closed on manifest errors (per CLAUDE rules).

Done When
	•	Build statically generates:
	•	/e
	•	/e/{electionId}
	•	/e/{electionId}/c/{contestId}
	•	/e lists all elections from the validated manifest; clicking through reaches contest pages.
	•	Deep links to any valid {electionId, contestId} render without runtime fetch.
	•	Invalid IDs trigger the 404 page.
	•	All internal links preserve any incoming ?v= param.
	•	Removing/altering the manifest to an invalid shape causes the build to fail (Zod throw bubbles up).

Output
	•	PR adding:
	•	app/e/page.tsx
	•	app/e/[electionId]/page.tsx
	•	app/e/[electionId]/c/[contestId]/page.tsx
	•	app/not-found.tsx (simple)
	•	Minimal helper for preserving ?v= in link construction (tiny util)
	•	Short NOTES file: how routes read from contracts manifest, and that UI polish lands in Stage 0c.
