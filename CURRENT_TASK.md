# Multi-Election Build Support

## Scope
Create a build script that generates data for all 4 district elections (districts 1-4) in serial order, updating the single manifest to include all contests. Skip mayor election for now.

## Context
- Current system only has District 2 data built
- CSV files exist for all 4 districts: `data/2024-11/canonical/district-{1,2,3,4}-cast-vote-record.csv`
- Each district has 3 seats: `d{N}-3seat`
- All use the same election: `portland-20241105-gen`
- Current manifest structure already supports multiple elections/contests
- Race conditions avoided by serial execution (no need for atomic writes/locks)

## Done When
1. `scripts/build-all-districts.ts` script exists that builds all 4 districts serially
2. Script calls existing build pipeline for each district: `ingestCvr` → `computeFirstChoiceBreakdown` → STV rounds
3. `npm run build:data:all` command works and produces working data for all districts
4. Manifest contains all 4 district contests under the same `portland-20241105-gen` election
5. UI can navigate between all 4 districts via existing routing (`/e/portland-20241105-gen`)
6. All existing tests pass

## Implementation Details
- Use existing `ingestCvr()` function with proper parameters for each district
- Use existing `computeFirstChoiceBreakdown()` and STV compute functions
- Districts: `d1-3seat`, `d2-3seat`, `d3-3seat`, `d4-3seat`
- CSV paths: `data/2024-11/canonical/district-{1,2,3,4}-cast-vote-record.csv`
- Keep all contract enforcement exactly as-is
- No architectural changes to manifest structure
- Serial execution eliminates race conditions

## Files to Modify
- `scripts/build-all-districts.ts` (new)
- `package.json` (add npm script)

## Files NOT to Change
- Any contract schemas
- Any existing compute functions
- Manifest structure
- UI routing or components
- Contract enforcement pipeline