How to keep slices small without creating file sprawl

1) One artifact per contest per slice (default).
Your rank_distribution_by_candidate should emit one Parquet for the entire contest, not per-candidate. Consumers filter by candidate_id with predicate pushdown. This keeps the slice narrow (clear contract) without producing N files.

2) Treat slices as “semantic tables,” not “one-off charts.”
Design each slice so multiple visualizations can use it. E.g., the rank-distribution slice supports:

Per-candidate rank bars

“Which ranks is this candidate most/least seen” tooltips

Cross-candidate heatmaps (candidate × rank)

3) Small-file control policy.
Adopt thresholds to prevent sprawl:

Target 1–50 MB per artifact (contest, slice).

If a slice would produce <1 MB across all ranks/candidates, keep it as a single file anyway.

If a slice naturally explodes (e.g., ballot-level paths), shard by round or source (surplus vs elimination)—but still avoid per-candidate shards unless absolutely necessary.

4) Parameterize at read time, not write time.
Prefer prebaked complete contest artifacts + client filters over prebaking per-candidate variants. Your static-first ethos is preserved (no server compute), and Parquet/ DuckDB give you efficient column + row predicate pushdown.

5) Reuse shared dims.
Keep candidates.parquet, contests.parquet as separate dimension artifacts (dictionary-encoded IDs). Slices then refer to IDs, cutting repetition and file size.

When to split a slice into multiple artifacts

Use these heuristics:

Different cadence: If parts recompute at different frequencies (e.g., slow transfer-matrix vs quick aggregates), split to avoid touching large artifacts unnecessarily.

Size blowup: If the artifact exceeds ~200–300 MB for a typical contest, consider sharding (by round or by a stable partition key).

Distinct consumers: If two UIs share no columns and no queries, splitting can simplify contracts and reduce client payload.

When not to split

Per-candidate files: avoid. They multiply object storage overhead and HTTP fetches, and you lose query flexibility.

Chart-specific shapes: don’t bake separate artifacts just to pivot columns; keep a tidy, normalized output and let the UI pivot.

Contract & schema tips that help long-term

Canonical columns: (election_id, contest_id, candidate_id, rank, count, pct_all_ballots, pct_among_rankers) is reusable. Don’t rename for each chart.

Full grids with zeros: Emitting 1..max_rank × candidate grid (zero counts allowed) makes charts trivial and avoids per-chart joins.

Precision policy: store full-precision floats; round only at render.

Manifest stats: include rowCount, max_rank, zero_rank_candidates so the UI can pre-size axes and show completeness badges without reading the whole file.

Performance notes (static-first)

Predicate pushdown works for you. A single contest-level Parquet with candidate_id and rank filters will be fast in DuckDB and in columnar scans.

Row groups: if you control export, aim for row groups large enough to amortize overhead (e.g., 8–64 MB), but don’t obsess—your artifacts are comparatively small.

Compaction step (optional): if you ever end up with many small parts (e.g., parallel compute), add a build step to merge into a single artifact per (contest, slice).

Sanity checklist for each new slice

✅ One file per (contest, slice) by default

✅ Normalized, reusable schema (not chart-specific)

✅ Manifest stats derived from validated rows

✅ No per-candidate prebakes

✅ UI filters (candidate, rank, round) instead of write-time params

So: keep the narrow slices (they’re great for determinism, contracts, and testability), but bundle by contest. You’ll end up with a tidy tree like:

/data/dev/<election>/<contest>/
  candidates.parquet
  first_choice.parquet
  stv_rounds.parquet
  rank_distribution.parquet   # ← fuels multiple candidate/rank UIs
  transfer_matrix.parquet     # (coming soon)
  manifest.json


That gives you the best of both worlds: small, composable semantics without a graveyard of micro-files.