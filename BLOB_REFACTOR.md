# Blob-backed Artifact Publishing & Resolution Implementation Plan

## Overview
Transition from filesystem-based artifact storage to Vercel Blob storage for production while maintaining filesystem access in development. This involves:
1. Extending manifest schema to support base_url + rel_path 
2. Creating a publisher script for Vercel Blob uploads
3. Updating ContestResolver to handle URL resolution by environment
4. Adding integrity verification for development/testing

## Current State Analysis

**Manifest Structure**: Your manifests use flat `uri` fields pointing to local filesystem paths (`data/dev/portland-20241105-gen/d2-3seat/stv/rounds.parquet`).

**Loader Architecture**: The `ContestResolver` class (src/lib/manifest/contest-resolver.ts:114-118) currently constructs URIs directly from manifest data. Your loaders in `loaders.ts` use these URIs directly with DuckDB's file reading capability.

**API Routes**: You have existing API routes (`src/app/api/*`) that use the Node.js runtime and handle DuckDB operations server-side.

**Build System**: Your build scripts (like `build-all-districts.ts`) compute artifacts and write manifests, but currently only to local filesystem.

**Environment**: Currently supports `dev`, `test`, `prod`, and `corrupt-test` environments with separate manifest files.

## Implementation Steps

### Phase 0: Public Directory Bridge (30 minutes)
**Quick incremental step before full blob implementation**

1. **Update environment configuration**:
   - Set `base_url: "/data/"` for prod environment
   - Keep existing filesystem paths for dev
   - This allows serving artifacts via Next.js `/public` directory

2. **Copy script for deployments**:
   - Create simple script to copy `data/prod/*` to `public/data/prod/*`
   - Maintains same path structure, just changes base URL
   - Zero schema changes needed initially

3. **Benefits**:
   - Immediate production deployment capability
   - No manifest schema changes yet
   - Easy rollback (just change base_url back)
   - Validates URL resolution logic before blob complexity

### Phase 1: Schema Extension & Backward Compatibility (2-3 hours)
1. **Update ArtifactRef schema** in `src/contracts/manifest.ts`:
   - Add optional `rel_path`, `bytes`, `mime` fields
   - Keep `uri` for backward compatibility
   - Add top-level `base_url` to Manifest schema

2. **Update ContestResolver** in `src/lib/manifest/contest-resolver.ts`:
   - Add `resolveArtifactUrl()` method that returns full URLs
   - Environment-aware: file:// for dev, Blob URLs for prod
   - Fallback to existing `uri` field for backward compatibility

### Phase 2: Publisher Script (3-4 hours)
1. **Create `scripts/publish_artifacts.ts`**:
   - Upload artifacts to Vercel Blob with hash-suffixed filenames
   - Pattern: `{env}/{electionId}/{contestId}/{slice}/{name}-{hash8}.parquet`
   - Update manifest with `base_url`, `rel_path`, `sha256`, `bytes`, `mime`
   - Support dry-run mode for testing

2. **Environment variables setup**:
   - `BLOB_READ_WRITE_TOKEN` (Vercel auto-scoped)
   - `DATA_BASE_URL_PROD` (blob storage base URL, or "/data/" for public bridge)
   - `DATA_BASE_URL_DEV` (file:// or http://localhost:8787/)

### Phase 3: Loader Updates (1-2 hours)
1. **Update all loader functions** in `src/lib/manifest/loaders.ts`:
   - Replace direct `uri` usage with `contestResolver.resolveArtifactUrl()`
   - URLs work with DuckDB's remote file capabilities
   - Add optional integrity checking in dev/test environments

### Phase 4: Pipeline Integration (1-2 hours)
1. **Update build scripts** to emit new manifest format:
   - Compute sha256, bytes, mime for each artifact
   - Generate rel_path with hash suffixes
   - Set appropriate base_url for environment

### Phase 5: Testing & Verification (2-3 hours)
1. **Create smoke tests**:
   - Verify artifact resolution works in both dev and prod
   - Test integrity checking functionality
   - Validate backward compatibility with existing manifests

2. **Add transfer_matrix artifacts** to manifest schema (currently hardcoded in ContestResolver)

## Design Details

### Manifest Schema Changes

Current manifest structure:
```json
{
  "env": "dev",
  "version": 2,
  "elections": [
    {
      "contests": [
        {
          "first_choice": {
            "uri": "data/dev/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
            "sha256": "38d66fcf...",
            "rows": 26
          }
        }
      ]
    }
  ]
}
```

New manifest structure:
```json
{
  "env": "prod",
  "version": 3,
  "base_url": "/data/", // Phase 0: public directory, Phase 2+: blob URL
  "elections": [
    {
      "contests": [
        {
          "first_choice": {
            "rel_path": "prod/portland-20241105-gen/d2-3seat/first_choice/first_choice-38d66fcf.parquet",
            "sha256": "38d66fcf...",
            "rows": 26,
            "bytes": 123456,
            "mime": "application/x-parquet",
            "uri": "data/dev/..." // kept for backward compatibility
          }
        }
      ]
    }
  ]
}
```

### URL Resolution Logic

```typescript
// ContestResolver.resolveArtifactUrl()
function resolveArtifactUrl(artifact: ArtifactRef, baseUrl: string): string {
  // Prefer new rel_path + base_url format
  if (artifact.rel_path) {
    return new URL(artifact.rel_path, baseUrl).toString();
  }
  
  // Fallback to existing uri for backward compatibility
  if (artifact.uri) {
    return new URL(artifact.uri, baseUrl).toString();
  }
  
  throw new Error("No path available for artifact");
}
```

### File Naming Convention

Immutable, hash-suffixed filenames for CDN caching:
```
{env}/{electionId}/{contestId}/{slice}/{name}-{hash8}.parquet

Examples:
- prod/portland-20241105-gen/d2-3seat/first_choice/first_choice-38d66fcf.parquet
- prod/portland-20241105-gen/d2-3seat/stv/rounds-82da9bd9.parquet
- dev/portland-20241105-gen/d2-3seat/transfer_matrix/transfer_matrix-3e7a9a12.parquet
```

## Risk Mitigation
- **Backward compatibility**: Existing `uri` field preserved as fallback
- **Environment isolation**: Dev continues using filesystem, prod uses blobs
- **Rollback capability**: Environment variables can switch back to filesystem
- **Gradual migration**: Can deploy with mixed old/new manifests

## Effort Estimate
**Total: 9.5-14.5 hours** spread across multiple work sessions
- **Phase 0 (Public bridge)**: 30 minutes
- Schema & resolver changes: 2-3 hours
- Publisher implementation: 3-4 hours  
- Loader updates: 1-2 hours
- Pipeline integration: 1-2 hours
- Testing & validation: 2-3 hours

## Success Criteria
✅ Publisher uploads artifacts with immutable hash-based names
✅ Manifests contain base_url + rel_path + integrity metadata
✅ ContestResolver returns environment-appropriate URLs
✅ All existing functionality works unchanged
✅ Smoke tests verify end-to-end artifact resolution
✅ Production uses Blob storage, development uses filesystem

## Touch Points

### Files to Modify
- `src/contracts/manifest.ts` - Schema extensions
- `src/lib/manifest/contest-resolver.ts` - URL resolution logic
- `src/lib/manifest/loaders.ts` - Use resolver URLs instead of direct URIs
- `scripts/build-all-districts.ts` - Emit new manifest format
- Create `scripts/publish_artifacts.ts` - Vercel Blob publisher

### Environment Variables
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob write access
- `DATA_BASE_URL_PROD` - Production blob storage base URL
- `DATA_BASE_URL_DEV` - Development filesystem/HTTP base URL

### Dependencies to Add
- `@vercel/blob` - Vercel Blob SDK for uploads
- Consider `node:crypto` for SHA-256 computation in publisher