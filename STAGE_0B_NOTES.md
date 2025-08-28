# Stage 0b Implementation Notes

## Routes Implementation

This stage implements the foundational routes for the election analysis platform using Next.js App Router with static generation.

### Route Structure

- `/e` - Elections index page
- `/e/[electionId]` - Individual election page  
- `/e/[electionId]/c/[contestId]` - Contest detail page
- `not-found.tsx` - 404 error page

### Static Generation

All routes use `generateStaticParams()` to create static pages at build time:

- **Elections Index**: Always renders (no params needed)
- **Election Pages**: Generated for each election ID from manifest
- **Contest Pages**: Generated for each (electionId, contestId) combination from manifest

### Data Source

Routes read from the **contracts manifest** at `src/packages/contracts/lib/manifest.ts`:

- **Single Source of Truth**: Manifest schema defined in contracts package following contract-first architecture
- **Function**: `loadManifestFromFs()` loads and validates manifest.json with Zod schema
- **Error Handling**: Graceful error messages for missing/invalid manifest files
- **Validation**: Runtime validation ensures data integrity

### Query Parameter Preservation  

The `?v=<buildId>` parameter is preserved across all internal navigation:

- **Utility**: `src/lib/link-utils.ts` provides `createLinkWithVersion()`  
- **Implementation**: All `<Link>` components use this utility to maintain version parameter
- **Breadcrumbs**: Navigation preserves query params throughout the route hierarchy

### Error Handling

- **Invalid IDs**: Routes call `notFound()` for unknown elections/contests
- **404 Page**: `not-found.tsx` provides user-friendly error page with navigation back to valid routes
- **Manifest Errors**: Clear error messages for manifest loading failures

### UI Implementation

**Current State**: Plain HTML placeholders with basic styling
- Uses simple Tailwind CSS classes for layout and styling
- No shadcn/ui components per Stage 0b scope
- Breadcrumb navigation with preserved query parameters
- Clear information hierarchy showing election → contest relationships

### Next Steps

Stage 0c will add UI polish with shadcn/ui components and enhanced interactivity. The current implementation provides the foundational routing and data layer for the platform.

### File Structure

```
src/
├── app/
│   ├── e/
│   │   ├── page.tsx                    # Elections index
│   │   └── [electionId]/
│   │       ├── page.tsx                # Election detail  
│   │       └── c/[contestId]/
│   │           └── page.tsx            # Contest detail
│   └── not-found.tsx                   # 404 handler
├── lib/
│   └── link-utils.ts                   # Query param utilities
└── packages/contracts/lib/
    └── manifest.ts                     # Manifest schema & loader
```

### Build Requirements Met

✅ Routes statically generate all valid election and contest pages  
✅ Deep links work without runtime fetches  
✅ Invalid IDs trigger 404 pages  
✅ Query parameter `?v=` preserved in all internal links  
✅ Manifest validation failures cause build to fail (Zod throws bubble up)  
✅ Uses contracts package as single source of truth for data structures