Title

[Stage 0a] Manifest Schema + Env-Aware Artifact Resolver (v1: flat layout)

Context

We need a single, validated manifest to enumerate elections/contests for static routes, and an artifact resolver that abstracts file paths. Current data is organized by environment (dev/, test/, prod/) and uses a flat structure. Stage 0a must honor that structure while establishing an API we can later point at a hierarchical tree—without touching pages.

Scope

Manifest (contract-first)

Add /manifest.json:

{
  "buildId": "<sha>",
  "elections": [
    {
      "id": "portland-2024-general",
      "name": "Portland General Election 2024",
      "contests": [
        { "id": "council-district-2", "name": "City Council District 2", "seats": 3 }
      ]
    }
  ]
}


Create lib/manifest.ts:

Zod schemas (Contest, Election, Manifest).

loadManifest() → reads and validates; throws with diagnostics on failure.

Export inferred TS types.

Environment selection (no I/O mutation)

Define DATA_ENV with allowed values: "dev" | "test" | "prod".

Add lib/env.ts:

getDataEnv() → reads process.env.DATA_ENV ?? "dev", validates (Zod), returns a frozen union type.

getArtifactRoot(env) → returns filesystem root (default /data/<env>). Do not create or write—resolver is read-only.

Artifact Resolver (v1: flat mapping)

Add lib/artifacts.ts:

getArtifacts(electionId, contestId, env) → returns paths for the known slices, mapping to existing flat files under /data/<env>/....

Guard: if (electionId, contestId) ≠ the canonical pair you currently support, throw:

“Flat layout only supports {portland-2024-general}/{council-district-2} in env=<env>.”

Return shape (extend as you add slices):

type ArtifactPaths = {
  electionSummary?: string;          // if you already export it
  firstChoiceParquet?: string;       // current summary fallback
  stvTabulationParquet: string;
  stvMetaParquet: string;
};


No file reads here—just deterministic path assembly.

Route static params (compile-time)

In /e/[electionId] and /e/[electionId]/c/[contestId], implement generateStaticParams() using loadManifest().

Pages may import getDataEnv() + getArtifacts() later; in Stage 0a they can just render IDs to prove enumeration works.

Guardrails

Contract-first: manifest & env both validated via Zod; builds fail on invalid config.

Read-only: resolver never writes; no cleanup needed; avoids test/dev thrash.

Env explicit: only "dev" | "test" | "prod" allowed; any other value fails fast with a clear message.

No scope creep: no UI, no shadcn, no visualization; skeleton pages may only render IDs.

Absolute imports per repo rules.

Done When

pnpm build fails with a useful error if manifest.json is malformed or DATA_ENV is invalid.

generateStaticParams() enumerates elections/contests from the validated manifest.

A placeholder contest page renders the {electionId, contestId} coming from static params.

getArtifacts() returns existing flat paths under /data/<env> and throws a clear error if called with unsupported IDs (protects against silent misroutes).

No writes occur in any code path; tests can set DATA_ENV=test without file thrash.

Output

PR containing:

manifest.json (seeded with one election/contest).

lib/manifest.ts (Zod + loader).

lib/env.ts (DATA_ENV contract).

lib/artifacts.ts (env-aware, flat resolver shim).

Minimal updates to [electionId] and [contestId] route files for generateStaticParams().

A 3–5 line ASSUMPTIONS.md note:

IDs are kebab-case and stable across builds.

DATA_ENV is read-only context selection (dev|test|prod), not a write target.

v1 resolver maps to current flat files under /data/<env>.

v2 will switch to /data/<env>/processed/{electionId}/{contestId}/... with no page changes.

buildId is a short hex SHA used for future ?v= pinning (not enforced in 0a).

Tiny code sketches (for clarity)
// lib/env.ts
import { z } from "zod";
const Env = z.enum(["dev", "test", "prod"]);
export type DataEnv = z.infer<typeof Env>;
export function getDataEnv(): DataEnv {
  return Env.parse(process.env.DATA_ENV ?? "dev");
}
export function getArtifactRoot(env: DataEnv) {
  // adjust if your monorepo uses a different base
  return `/data/${env}`;
}

// lib/artifacts.ts
import { getArtifactRoot, type DataEnv } from "@/lib/env";

const CANON_ELECTION = "portland-2024-general";
const CANON_CONTEST  = "council-district-2";

export type ArtifactPaths = {
  firstChoiceParquet?: string;
  stvTabulationParquet: string;
  stvMetaParquet: string;
};

export function getArtifacts(electionId: string, contestId: string, env: DataEnv): ArtifactPaths {
  if (electionId !== CANON_ELECTION || contestId !== CANON_CONTEST) {
    throw new Error(`Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=${env}).`);
  }
  const root = getArtifactRoot(env);
  return {
    firstChoiceParquet: `${root}/summary/first_choice.parquet`,
    stvTabulationParquet: `${root}/stv/stv_rounds.parquet`,
    stvMetaParquet: `${root}/stv/stv_meta.parquet`,
  };
}

// lib/manifest.ts
import { z } from "zod";
import fs from "node:fs/promises";
const Contest = z.object({ id: z.string(), name: z.string(), seats: z.number().int().positive() });
const Election = z.object({ id: z.string(), name: z.string(), contests: z.array(Contest).nonempty() });
export const Manifest = z.object({ buildId: z.string().min(6), elections: z.array(Election).nonempty() });
export type ManifestT = z.infer<typeof Manifest>;

export async function loadManifest(path = "manifest.json"): Promise<ManifestT> {
  const raw = await fs.readFile(path, "utf8");
  return Manifest.parse(JSON.parse(raw));
}


This keeps your env directory discipline intact, avoids test/dev clobbering, and sets you up to flip to a hierarchical tree later by changing only the resolver.

Files to add

manifest.json (nav manifest; seed with one election & one contest).

lib/manifest.ts (Zod schemas + loadManifest()).

lib/env.ts (getDataEnv(), getArtifactRoot(); enum-validated).

lib/artifacts.ts (env-aware, flat resolver shim; read-only).

Minimal updates to /e/[electionId]/page.tsx and /e/[electionId]/c/[contestId]/page.tsx to use generateStaticParams() from loadManifest() and render IDs (placeholders).

Do not touch

Existing /demo/* routes.

src/packages/contracts/lib/artifact-paths.ts.

Slice manifests (manifest.dev.json, manifest.test.json).

Env directories

Resolver builds paths like /data/<env>/summary/first_choice.parquet, /data/<env>/stv/stv_rounds.parquet, /data/<env>/stv/stv_meta.parquet.

No writes. No cleanup. Read-only.

Assumptions (document in PR)

IDs are kebab-case and stable.

DATA_ENV is one of dev|test|prod (default dev).

Flat layout supports exactly the seeded (electionId, contestId) pair; others error.

Later migration moves to /data/<env>/processed/{electionId}/{contestId}/… by editing only lib/artifacts.ts.

buildId is a hex SHA (string length ≥ 6) for future URL pinning; not enforced in 0a.