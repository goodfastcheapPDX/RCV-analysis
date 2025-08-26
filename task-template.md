Title: name of vertical slice

Context (spec packet): 
- stuff
- you must know
- to implement this feature

Scope:
1. every step
2. of completing
3. the task

Guardrails:
- things you
- must avoid
- to control scope creep and thrash

Done When:
- exact clear success criteria

Output:
- any artifacts of completion. for example, a PR, a working branch, a report document of completion, etc

---
Example Tasks:

## 1) Baseline aggregate slice (non-param)

**Goal:** Yearly counts + percentiles for `<metric>`.

```
Title: Build slice `<agg_by_year_<metric>>` end-to-end

Context:
- Raw CSV at ${SRC_CSV}. Dataset is immutable.
- Repo uses slice contracts (Zod), DuckDB SQL, Arrow artifacts, and Storybook compare.

Scope:
1) Create `packages/contracts/slices/<agg_by_year_<metric>>/index.contract.ts`
   - Output schema (Zod):
     { year: int, count: int, p50_<metric>: number|null, p95_<metric>: number|null }
   - version: 1.0.0
   - sql: Single SELECT using read_csv_auto(${SRC_CSV}), with cleaning rules:
     - drop NULL `year`
     - treat non-numeric `<metric>` as NULL
2) Implement `compute.ts` → runs SQL via node-duckdb, writes Arrow (content-hashed), updates manifest.
3) Implement `view.tsx` → line chart (year on X; series: count, p50, p95).
4) Storybook `<agg_by_year_<metric>>.story.tsx` with “Live vs Static” toggle and auto-diff banner.
5) Tests:
   - Contract test: column presence/types.
   - Sample rows test: year monotonic, count≥0, p95≥p50 when both non-null.
6) Docs: Append CHANGELOG entry.

Guardrails:
- No edits outside the new slice folder, `manifest.json`, and Storybook registration.
- No refactors of shared providers.
- Keep compute ≤ 60s on a laptop; if not, stop and report the slow step.

Done When:
- `pnpm build:data` creates artifact and updates `manifest.json`.
- Storybook shows identical Live vs Static (green).
- `pnpm test -w packages/contracts` passes.

Output:
- PR diff, commands to run locally, and a 5-line summary of assumptions made about `<metric>`.
```

---

## 2) Parameterized “Top-N by category”

**Goal:** For a chosen `<category_col>`, return top-N `<metric>` by `<sort_measure>` for a selected `<year>`.

```
Title: Build parameterized slice `<topN_<category>>` end-to-end

Scope:
1) Contract Output:
   { year:int, category:string, value:number, rank:int }
   Params: { year:int, n:int=10 }
   version: 1.0.0
   sql: Use DuckDB parameters; dense_rank over value desc; filter year=:year; limit :n
2) compute.ts:
   - Pre-materialize for the 5 most common years (discover via SQL) into 5 Arrow files
   - Write manifest entry with param index: availableYears:[…]
3) view.tsx:
   - Horizontal bar chart; control for year and N (default 10, clamp 5–25)
4) Storybook:
   - Knobs for year and N
   - Live vs Static comparison at year=mode(Year), N=10
5) Tests:
   - Rank increments by 1 without gaps; rank≤N
   - If ties, deterministic tiebreak on `category` asc

Guardrails:
- Do not implement server filtering; all in SQL + prebaked variants.
- If the CSV lacks `<category_col>` or `<metric>`, stop with diagnostic and propose alternates.

Done When: build, tests, and Storybook compare are green.
```

---

## 3) Histogram pre-binning (chart-ready)

**Goal:** 40-bin histogram of `<metric>` with min/max and null\_frac stats.

```
Title: Build slice `<hist_<metric>_40>` end-to-end

Scope:
1) Output:
   { bin_left:number, bin_right:number, count:int, total:int }
   plus stats sidecar in manifest: {min:number|max:null, max:number|null, null_frac:number}
2) SQL:
   - Compute global min/max excluding NULL
   - Use width_bucket to 40 bins; include empty bins
3) view.tsx:
   - Column chart; show min/max; if null_frac>0.1, render warning ribbon
4) Storybook:
   - Live vs Static toggle
5) Tests:
   - Sum(count)==total
   - Consecutive bins: bin_left of i+1 equals bin_right of i (within float tol)

Guardrails: No per-user params; one artifact only.

Done When: build, tests, compare green.
```

---

## 4) Geo choropleth (join to reference shapes)

**Goal:** Aggregate by `<geo_id>` and map.

```
Title: Build slice `<geo_<id>_choropleth>` end-to-end

Scope:
1) Inputs:
   - CSV column `<geo_id>` (string/int)
   - Static TopoJSON at `/public/geo/<name>.topo.json` with property `gid`
2) Output:
   { gid:string, value:number|null } and manifest stats: coverage_pct
3) SQL:
   - Group by gid, compute mean `<metric>`; cast gid to string
4) view.tsx:
   - Use map component; color scale with legend
   - If coverage_pct<0.9, show “incomplete coverage” notice
5) Tests:
   - Number of output rows ≤ number of topo features
   - No duplicate gid

Guardrails:
- Do not modify map lib internals; consume existing Map component only.

Done When: build, tests, compare green.
```

---

## 5) “Drip” projection endpoint (dev-only utility)

**Goal:** Minimal endpoint to stream selected columns for a given slice (for large artifacts during dev).

```
Title: Add dev endpoint `/_dev/select?slice=<key>&cols=a,b,c&where=...`

Scope:
1) Create Next.js route `app/_dev/select/route.ts`
   - Parse query: slice key, columns (optional), where (optional simple predicates)
   - Execute the slice SQL via node-duckdb with projection and WHERE if provided
   - Stream Arrow chunked response; cap at 200k rows
2) Respect `DATA_MODE=live` only; return 404 in prod
3) Log counters: rows_returned, bytes_sent

Guardrails:
- No joins beyond the slice’s defined SQL.
- Reject complex predicates; only AND of simple comparisons (`=,>,<,IN`).

Done When:
- Manual curl returns Arrow; basic smoke test added.
```

---

## 6) Regression “compare” guard (infra slice)

**Goal:** CI check to fail on drift between prebaked and live.

```
Title: Implement `/_dev/compare?slice=<key>` + CI step

Scope:
1) Route returns:
   { same:boolean, rowCount:{live,static}, checksums:{live,static}, minmax:{...}, diffSampleUrl?:string }
2) CLI `pnpm compare:slice <key>` → prints table and nonzero exit on mismatch
3) Add GH workflow job to run for changed slices

Guardrails: No fuzzy matching; exact equality for counts and checksums; min/max compared exactly for numeric inputs.

Done When: CI fails on intentional mismatch in a test branch; passes on main.
```

---

## 7) Bugfix prompt (scoped, surgical)

```
Title: Fix `<sliceKey>` p95 calculation error

Scope:
- Do not change Output schema or version.
- Only adjust the SQL in `index.contract.ts` and re-export artifacts.
- Add a failing unit test that reproduces the bug (describe the input shape).
- Update CHANGELOG with a “patch” note.

Done When:
- Test turns green with the fix.
- Live vs Static compare is green.
```

---

## 8) Refactor prompt (no behavior change)

```
Title: Refactor `<sliceKey>` compute for readability (no output change)

Scope:
- May reorganize CTEs and comments only.
- Must keep identical results: checksum and row counts must match previous artifact.
- Add inline docstrings explaining each CTE’s role.

Guardrails:
- If any output diff is detected, stop and revert; open a diagnostic note.

Done When:
- Compare shows identical; tests pass.
```

---

## 9) “Red-flag” UX hook (global)

```
Title: Add global red-flag banner when slices violate declared domains

Scope:
- Implement a small util that reads manifest stats and raises flags:
  - null_frac > <0.1> or values out of declared min/max
- Surface a non-modal banner on affected views; include “see details” drawer.

Guardrails: No changes to data pipeline.

Done When: Demo with `<hist_<metric>_40>` shows banner when you artificially break stats in Live mode.
```

---

## 10) One-page “micro-brief” (use when you’re rushed)

```
Implement ONE slice:
Key: <key>
Output columns: <list>
Params: <none|list>
SQL idea: <1–3 lines>
View: <chart/table>
Done When: build OK, tests OK, Storybook Live=Static
Out of scope: anything not in the slice folder + manifest + story
Stop if: missing columns, >60s compute, >200MB artifact
```