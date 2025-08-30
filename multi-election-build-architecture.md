# Multi-Election Build Architecture Analysis

## Current State Analysis

**Manifest Architecture:**
- Single `data/{env}/manifest.json` file per environment
- Schema supports multiple elections and contests natively (`Manifest.elections: Election[]`)
- Each slice (`ingest_cvr`, `first_choice_breakdown`, `stv_rounds`) writes to the same manifest file
- File locking: **NO** - pure read-modify-write with race conditions

**Current Build Pattern:**
```typescript
// Each slice does:
1. Read existing manifest (or create new)
2. Find/create election + contest 
3. Update contest section
4. Write entire manifest back to disk
```

## Design Options

### Option 1: Sequential Builds (Simplest)
**Approach:** Build one election at a time, all slices for each election
```bash
# For each election:
npx tsx scripts/build-data.ts --election=portland-20241105-gen --contest=d1-3seat --src-csv=...
npx tsx scripts/build-first-choice.ts  # reads from manifest
npx tsx scripts/build-stv.ts          # reads from manifest
```

**Pros:** No architecture changes, works with current code
**Cons:** Slower (can't parallelize), still has race conditions between slices

### Option 2: Manifest Staging + Merge
**Approach:** Each build writes to temp manifests, then merge
```bash
# Parallel builds to separate files:
build-data.ts → manifest-d1.json
build-data.ts → manifest-d2.json  
# Then: merge-manifests.ts → manifest.json
```

**Pros:** Enables parallelization, atomic final merge
**Cons:** Requires new merge logic, complex error handling

### Option 3: Manifest Lock Coordination
**Approach:** Add file locking to manifest writes
**Pros:** Enables true parallel builds
**Cons:** Complex locking logic, platform-specific

### Option 4: Separate Manifests Per Contest
**Approach:** `data/{env}/{electionId}/{contestId}/manifest.json`
**Pros:** No coordination needed, perfect parallelization  
**Cons:** Major architecture change, UI must aggregate manifests

### Option 5: Database-Backed Manifest
**Approach:** Store manifest in SQLite/DuckDB instead of JSON
**Pros:** ACID transactions, perfect for concurrent updates
**Cons:** Major architecture overhaul

## Recommended Solution: Option 1 + Batch Script

**Why:** Minimal risk, works immediately, addresses 80% of the value

**Implementation:**
1. Create `scripts/build-all-elections.ts` that builds sequentially:
   - District 1 (3 seats): `d1-3seat`
   - District 2 (3 seats): `d2-3seat` (already exists)
   - District 3 (3 seats): `d3-3seat` 
   - District 4 (3 seats): `d4-3seat`
   - Mayor (1 seat): `mayor-1seat`

2. For each election: run all 3 build phases (ingest → first_choice → stv)

3. Add npm script: `"build:data:all": "npx tsx scripts/build-all-elections.ts"`

**Future Migration Path:** Can later upgrade to Option 2 for parallelization if needed

**Time Estimate:** ~2 hours vs ~2 days for architectural changes