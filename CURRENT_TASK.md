Title: Implement slice `first_choice_breakdown` (no UI; Parquet artifacts + validator)

Context (spec packet): 
- Build first choice vote analysis from previously processed ballots_long data
- Export structured data for downstream analysis and visualization
- Implement comprehensive validation against golden datasets
- Follow contract-first development workflow

Scope:
1. **CONTRACT FIRST**: Create complete contract with schema, SQL queries, and validation rules
2. Implement compute.ts that reads ballots_long.parquet and exports first_choice.parquet
3. Create validation script with structural + semantic checks + official results comparison
4. Add package.json scripts and wrapper scripts for build/validate operations
5. Write comprehensive tests following existing golden case patterns
6. Implement SHA256 content-based file hashing for manifest integrity
7. Update manifest structure to support nested stats format

**Technical Specifications:**

Input: `data/ingest/ballots_long.parquet` (from ingest_cvr slice)
Output: `data/summary/first_choice.parquet`

Schema:
```
candidate_name TEXT,
first_choice_votes BIGINT, 
pct FLOAT  -- 0..100 with 4 decimal places
```

Manifest stats:
```json
{
  "total_valid_ballots": int,
  "candidate_count": int, 
  "sum_first_choice": int
}
```

SQL Logic:
1. Load ballots_long from parquet
2. Filter for rank_position = 1 AND has_vote = TRUE
3. Group by candidate_name, count votes, calculate percentages
4. Order by first_choice_votes DESC, candidate_name ASC

Validation Requirements:
- sum(first_choice_votes) == ballots_with_votes from ingest_cvr manifest
- 0 <= pct <= 100 for all rows; |sum(pct) - 100| <= 0.01
- No NULL candidate_name; no negative counts
- Compare against official results JSON if present

Guardrails:
- Use contract-first development - write complete contract before any implementation
- Follow existing ingest_cvr patterns for DuckDB, manifest, and file structure
- Use parquet format (not arrow) for consistency
- Implement deterministic SHA256 hashing based on file content
- No JSON table exports - only parquet + manifest updates
- Add proper error handling and transaction rollbacks

Done When:
- Contract defines all schemas, SQL queries, and validation rules
- `npm run build:data:firstchoice && npm run validate:firstchoice` pass on golden cases
- Manifest contains `first_choice_breakdown@1.0.0` with correct nested stats and SHA256 hashes
- Tests verify math correctness against micro golden case
- Official results comparison works (when JSON present)

Output:
- Complete vertical slice with contract → compute → validate → tests
- Working npm scripts: `npm run build:data:firstchoice`, `npm run validate:firstchoice --case=<name>`, `npm run validate:firstchoice --all`
- Brief note on name-normalization strategy used for official results comparison