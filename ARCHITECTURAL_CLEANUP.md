# Architectural Cleanup: Duplicate Manifest/Resolver Systems

## Overview

During the implementation of contest-scoped pages, we identified significant architectural duplication in the manifest and contest resolution system. This document outlines the duplication, impact, and recommended cleanup.

## Current Duplication

### Three Competing Systems

We currently have **3 different approaches** to manifest resolution and data loading:

#### 1. Legacy `src/lib/artifacts.ts` ✅ **REMOVED**
- **Status**: ✅ Already removed
- **Problem**: Hard-coded to single election/contest pair
- **Usage**: Only used in its own test file (zero production usage)

#### 2. Old `src/lib/contest-resolver.ts` ❌ **SHOULD BE REMOVED**
- **Lines of Code**: 194 lines
- **Contains**: 
  - `loadStvForContest()` - 94 lines of DuckDB code
  - `loadFirstChoiceForContest()` - 49 lines of DuckDB code  
  - `loadContestData()` - uses deprecated `getContestArtifacts()`
- **Problems**:
  - Still imports from legacy `@/lib/manifest`
  - Duplicates functionality now in `manifest/loaders.ts`
  - Mixing concerns (resolution + data loading + DuckDB operations)

#### 3. Legacy `src/lib/manifest.ts` ❌ **PARTIALLY OBSOLETE**
- **Contains**:
  - `getContestArtifacts()` - **same functionality as new ContestResolver**
  - Legacy type definitions that don't match real manifest schema
  - `loadManifest()` functions (still needed)
- **Problems**:
  - `getContestArtifacts()` duplicates `ContestResolver` methods
  - Legacy types confuse the codebase
  - Mix of needed and obsolete functions

#### 4. New System ✅ **CURRENT BEST PRACTICE**
- **Files**: 
  - `src/lib/manifest/contest-resolver.ts` (60 lines, clean)
  - `src/lib/manifest/loaders.ts` (80 lines, clean)
- **Architecture**:
  - **ContestResolver**: Clean class-based manifest resolution
  - **Loaders**: Focused DuckDB data loading with contract validation
  - **Separation of Concerns**: Resolver only finds URIs, loaders handle data
- **Benefits**:
  - ✅ Contract-enforced validation
  - ✅ Dependency injection for testing
  - ✅ No filesystem checks in resolver
  - ✅ Comprehensive test coverage with real data
  - ✅ Works with any election/contest (not hardcoded)

## Impact Analysis

### Code Duplication
- **loadStvForContest**: Exists in both `contest-resolver.ts` (94 lines) and `manifest/loaders.ts` (37 lines)
- **loadFirstChoiceForContest**: Exists in both `contest-resolver.ts` (49 lines) and `manifest/loaders.ts` (24 lines)
- **Contest Resolution**: Both `getContestArtifacts()` and `ContestResolver` class do the same thing

### Migration Status
- ✅ **Pages**: All migrated to new loaders
- ✅ **API Handlers**: Just migrated to new loaders  
- ❌ **Old Files**: Still exist and cause confusion

### Test Coverage
- **Old System**: Basic tests
- **New System**: Comprehensive tests with in-memory databases, real data validation, dependency injection

## Recommended Actions

### Phase 1: Remove Old Contest Resolver ❌→✅
```bash
rm src/lib/contest-resolver.ts
```

**Files affected:**
- Check imports and update to use `manifest/loaders.ts`

### Phase 2: Clean Up manifest.ts ❌→⚠️
**Keep:**
- `loadManifest()` and `loadManifestSync()` - still needed
- Re-exports from `@/contracts/manifest`

**Remove:**
- `getContestArtifacts()` - duplicates `ContestResolver`
- Legacy type definitions (`Contest`, `Election`, `ManifestT`)

### Phase 3: Update Remaining Usage ❌→✅
- Update any remaining imports to use new system
- Remove test script dependencies on old functions

## Benefits of Cleanup

### Code Quality
- **-137 lines**: Remove duplicate `loadStvForContest` (94 lines) and `loadFirstChoiceForContest` (49 lines)
- **Better Architecture**: Clear separation between resolution and data loading
- **Single Source of Truth**: Only one way to resolve contests and load data

### Maintainability  
- **No Confusion**: Clear which system to use for new features
- **Better Testing**: In-memory databases vs file system dependencies
- **Contract Enforcement**: All data loading goes through Zod validation

### Performance
- **New System**: More efficient with smaller, focused functions
- **Better Caching**: Resolver can be reused, doesn't read files repeatedly
- **Dependency Injection**: Better for testing and performance

## Verification Checklist

Before cleanup:
- [ ] Verify all pages use new loaders
- [ ] Verify all API handlers use new loaders  
- [ ] Check for any remaining imports of old functions
- [ ] Run full test suite to ensure no breakage
- [ ] Update any documentation or scripts

After cleanup:
- [ ] All tests still pass
- [ ] No broken imports
- [ ] API endpoints still work
- [ ] Pages still render correctly
- [ ] Build process succeeds

## Timeline

This cleanup should be done **immediately** to prevent further architectural drift and confusion for future development.