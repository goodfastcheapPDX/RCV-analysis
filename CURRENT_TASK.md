Title: Implement headless ingestion + validator for `ingest_cvr`

Scope:
1) Write `compute.ts` to build DuckDB tables and export Arrow via:
   COPY candidates   TO 'data/ingest/candidates.arrow'  (FORMAT 'arrow');
   COPY ballots_long TO 'data/ingest/ballots_long.arrow'(FORMAT 'arrow');
   Update manifest with stats + SHA256 hashes.

2) Create `scripts/validateIngest.ts`:
   - Open DuckDB, create views over the two Arrow files.
   - Run invariant queries above.
   - Parse `manifest.json`; assert exact equality with computed stats.
   - Recompute SHA256 of both files; assert equality with manifest.

3) Add golden test:
   - Env `SRC_CSV=tests/golden/micro/cvr_small.csv`
   - Load `*.expect.json`; assert numeric stats equal.
   - Exit nonzero on any failure.

Guardrails:
- No UI files. No JSON artifacts besides manifest.
- If header regex fails for any column, print the list and exit 1.
- Deterministic output: forbid timestamps in Arrow files; keep ordering stable.

Done When:
- `pnpm build:data && pnpm validate:ingest && pnpm validate:golden` all pass,
  and a second run of `pnpm build:data` yields identical hashes.
