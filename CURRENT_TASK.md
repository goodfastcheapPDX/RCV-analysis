Title: Implement slice `stv_rounds` (per-round tallies & events with official comparison)

You are implementing ONE vertical slice end-to-end. Stay inside the new slice folder, manifest, and tests only. If blocked, STOP and print a diagnostic + next step.

Goal
Compute Single Transferable Vote (STV) round-by-round tallies from `ballots_long.parquet`, write contracted parquet artifacts, and validate against official JSON results when present.

Inputs
- Artifacts from `ingest_cvr`:
  - `data/{env}/ingest/ballots_long.parquet`
    Schema: BallotID, PrecinctID?, BallotStyleID?, candidate_id, candidate_name, rank_position, has_vote (TRUE)
- Rules file per case (YAML): seats, quota=droop, surplus_method=fractional (Gregory), precision (default 1e-6), tie_break=lexicographic.
- Optional official JSON per case: `tests/golden/<case>/official-results.json`

Outputs (artifacts)
1) `data/stv/stv_rounds.parquet`  (one row per candidate per round)
   Schema:
     round INT, candidate_name TEXT, votes DOUBLE,
     status TEXT  -- 'standing' | 'elected' | 'eliminated'
2) `data/stv/stv_meta.parquet`   (one row per round)
   Schema:
     round INT, quota DOUBLE, exhausted DOUBLE, elected_this_round TEXT[] NULL, eliminated_this_round TEXT[] NULL

Manifest
- Key: `stv_rounds@1.0.0`
- Include file hashes, row counts, number_of_rounds, winners (sorted), seats, quota (first-round), and precision used.

Computation Requirements
- Quota: Droop = floor(total_valid_ballots / (seats + 1)) + 1
- First-choice tallies are round 1 base.
- Election rule: candidate >= quota ⇒ elected in that round.
- Surplus transfers: fractional (Gregory) weighting from each elected candidate’s ballots:
    weight = surplus / candidate_total, applied to next-preference continuing candidates.
- Elimination: if no one reaches quota, eliminate the lowest tally candidate (tie_break=lexicographic on candidate_name unless overridden by rules).
- Continuing candidates: exclude elected/eliminated from future preference searches.
- Exhausted: ballots with no further valid preferences become exhausted and stay in exhausted pool.
- Continue until seats filled or candidates <= seats.

Precision & Determinism
- Use decimal math with FLOAT but compare with tolerance `precision` from rules (default 1e-6).
- Deterministic ordering: when multiple events happen in one round (e.g., multiple elected from transfers), order `elected_this_round` lexicographically.
- No randomness. If tie_break requires randomness, accept `random:seed=<int>` in rules and use it.

Scope (files to create)
1) `packages/contracts/slices/stv_rounds/index.contract.ts`
   - Zod schemas:
     OutputRow = z.object({
       round: z.number().int().positive(),
       candidate_name: z.string(),
       votes: z.number().nonnegative(),
       status: z.enum(['standing','elected','eliminated'])
     })
     MetaRow = z.object({
       round: z.number().int().positive(),
       quota: z.number().positive(),
       exhausted: z.number().min(0),
       elected_this_round: z.array(z.string()).optional().nullable(),
       eliminated_this_round: z.array(z.string()).optional().nullable()
     })
     Stats = z.object({
       number_of_rounds: z.number().int().positive(),
       winners: z.array(z.string()),
       seats: z.number().int().positive(),
       first_round_quota: z.number().positive(),
       precision: z.number().positive()
     })
     export const version = '1.0.0'

2) `packages/contracts/slices/stv_rounds/engine.ts`
   - Pure TS implementation of STV per above rules.
   - API: `runSTV(ballotsLong: Row[], rules: Rules): { rounds: OutputRow[]; meta: MetaRow[]; winners: string[] }`
   - Must pass Zod parse on every emitted row before COPY.
   - Efficiency target: handle ~100k ballots, dozens of candidates within <60s locally.

3) `packages/contracts/slices/stv_rounds/compute.ts`
   - Open DuckDB DB; `CREATE VIEW ballots_long AS SELECT * FROM 'data/{env}/ingest/ballots_long.parquet'`
   - Load rows needed for engine as JSON via `SELECT BallotID, candidate_name, rank_position FROM ballots_long ORDER BY BallotID, rank_position`
   - Load rules from `tests/golden/<case>/rules.yaml` if CASE env is set; else use defaults (seats from env `SEATS` required).
   - Call `runSTV(...)`, validate all rows with Zod, then:
       * Create temp DuckDB tables `tmp_stv_rounds`, `tmp_stv_meta`
       * INSERT validated rows
       * COPY to parquet:
         COPY tmp_stv_rounds TO 'data/stv/stv_rounds.parquet' (FORMAT 'parquet');
         COPY tmp_stv_meta   TO 'data/stv/stv_meta.parquet'   (FORMAT 'parquet');
   - Update manifest under `stv_rounds@1.0.0` with Stats + SHA256 file hashes.

4) Validation CLI: `scripts/validateStvRounds.ts`
   - Read artifacts back via DuckDB; assert:
     a) Each round has every continuing candidate (status consistent)
     b) Per-round conservation: sum(votes of continuing + exhausted) equals previous round’s sum (± precision), after adding transfers/elimination effects
     c) Winners length == seats; winners are exactly those with status 'elected' in some round
   - If `official-results.json` exists for CASE:
     - Normalize names (map provided if needed).
     - Compare per round:
        • candidate set equality
        • tallies within `precision`
        • elected/eliminated events sequences equal
        • quota equals official threshold (numeric)
     - On first mismatch, print compact diff and exit nonzero.

5) Tests
   - Micro cases (3–20 ballots): exact match to `expect.json` (no tolerance).
   - Real case (e.g., Portland D2): match official JSON within precision.
   - Contract tests: assert `Output.parse` and `MetaRow.parse` are called before COPY; `Stats` validated in manifest.

Guardrails
- Do NOT implement Sankey/visualization; data/validation only.
- Do NOT read raw CSV directly; read only `ballots_long.parquet`.
- Must call `Output.parse` / `MetaRow.parse` for every row and `Stats.parse` for manifest (fail build if absent).
- Deterministic: when multiple lowest tallies tie and tie_break=lexicographic, choose alphabetically; document the chosen candidate in meta (optional `tiebreak_note`).

Done When
- `npm run build:data:stv` writes `data/stv/stv_rounds.parquet` and `data/stv/stv_meta.parquet`
- `npm run validate:stv --case=<golden>` passes on micro and at least one real case with official JSON
- Manifest contains `stv_rounds@1.0.0` with correct winners, rounds, quota, precision, and hashes

Developer commands to print at the end
- `CASE=portland_d2_2024 SEATS=3 npm run build:data:stv && npm run validate:stv --case=portland_d2_2024`
- `npm run validate:stv --all`
- Note any name-normalization applied
