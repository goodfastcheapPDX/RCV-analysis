# Task: Extract Generic Heatmap Base Component

## Objective
Factor out a tiny, generic heatmap "base" and keep two thin wrappers: one for Raw and one for Jaccard. This prevents tight-coupling of data contracts while sharing 90% of UI polish.

## Problem
Current view bakes in raw-specific field names (`cooccurrence_frac`, `cooccurrence_count`, `max_pair_frac`) and tooltip copy. Reusing wholesale would either force awkward prop shims or risk breaking raw when tweaking normalized behavior.

## Solution: Minimal Refactor (Safe & Surgical)

### 1. Extract Generic Base Component
**File:** `src/features/coalitions/common/CoalitionHeatmapBase.tsx`

**Props (pure-view; no domain names):**
- `rows: string[]`, `cols: string[]`
- `values: Record<string, number>` (pre-computed for performance)
- `maxValue: number`
- `formatTooltip: (rowId: string, colId: string, value: number) => ReactNode`
- `controls: ReactNode` (slot for sliders/toggles)
- `onCellClick?: (rowId: string, colId: string) => void` (for pinned tooltip pattern)

**Contains:** Nivo ResponsiveHeatMap, axis formatters, pinned tooltip container, shell Cards

### 2. Extract Shared Utilities
**File:** `src/features/coalitions/common/utils.ts`
- `useSortedCandidates(candidates?, fallbackIds: number[])` - last-name axis logic
- `buildSymmetricGetter(pairMap, getKey)` - returns values Record that auto-mirrors and zeros diagonal

### 3. Thin Wrapper Adapters

#### Raw (existing file, keep name/API)
**File:** `src/features/coalitions/views/CandidateAffinityMatrixView.tsx`
- Builds `pairMap` from `{candidate_a, candidate_b, cooccurrence_frac}`
- Passes `maxValue = stats.max_pair_frac`
- Formats tooltip with "co-occurrence" language + `cooccurrence_count`

#### Jaccard (new)
**File:** `src/features/coalitions/views/CandidateAffinityJaccardView.tsx`
- Builds `pairMap` from `{candidate_a, candidate_b, jaccard}`
- Passes `maxValue = stats.max_jaccard`
- Tooltip shows Jaccard, `pair_count`, `union_count`, `presence_a/b`
- Control copy "Minimum Jaccard" instead of "Minimum Co-occurrence"

### 4. Shared Controls Component
**File:** `src/features/coalitions/common/Controls.tsx`
**Props:**
- `minLabel`, `maxLabel`, `min=0`, `max=maxValue`, `default=0`, `step=0.001`
- `topKEnabled`, `topKMax`

### 5. Routing Structure
- Raw: `/coalitions/raw` → uses Raw adapter
- Jaccard: `/coalitions/jaccard` → uses Jaccard adapter
- Add toggle in page chrome to swap routes/datasets

## Implementation Steps

1. **Create CoalitionHeatmapBase.tsx** - Copy Nivo config, pinned tooltip frame, header/legend shell
2. **Extract shared utilities** - `useSortedCandidates` + `buildSymmetricGetter` 
3. **Rewrite Raw view** - Build `pairMap<number>` and pass props to Base
4. **Implement Jaccard view** - Similar structure with Jaccard stats and tooltip text
5. **Update routes** - Change to `/raw` and `/jaccard`, add route toggle
6. **Add Storybook stories** - One per adapter plus base snapshot with mock props

## Key Patterns to Preserve
- Canonical pair key (a-b with a<b) and diagonal = 0 rule
- Last name axis formatting 
- Pinned tooltip pattern (container in base, content via formatTooltip)
- Threshold slider binding (isolated in adapters)

## Success Criteria
- [ ] Shared UX without entangling data contracts
- [ ] Each slice remains testable
- [ ] Future metrics (Lift, Cosine, etc.) require only thin adapters
- [ ] All existing functionality preserved
- [ ] Tests pass

## Files to Create/Modify
- **Create:** `src/features/coalitions/common/CoalitionHeatmapBase.tsx`
- **Create:** `src/features/coalitions/common/utils.ts`  
- **Create:** `src/features/coalitions/common/Controls.tsx`
- **Create:** `src/features/coalitions/views/CandidateAffinityJaccardView.tsx`
- **Modify:** `src/features/coalitions/views/CandidateAffinityMatrixView.tsx`
- **Modify:** Route files for `/raw` and `/jaccard`