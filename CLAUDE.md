# Development Rules

## Available Scripts
1. `npm test`
2. `npm run lint`
3. `npm run format`
4. `npm run build:data:all`
5. `npm run build`
6. `npm run test:debug`
7. `npm run coverage`
8. `npm run coverage:debug`
9. `npm run dev`

## Core Architecture
- **Contract-first**: All data uses Zod schemas from contracts. No manual types in app layer.
- **Slice development**: Features go in `src/contracts/slices/` as vertical slices (contract + compute + view + tests)
- **CURRENT_TASK.md**: Never work outside its scope. Never modify without passing commit.

## Testing & Quality
- All tests must pass before any commit
- No mocks - use real test setups and in-memory databases  
- Test files as neighbors: `route.tsx` → `route.test.tsx`
- Use container-scoped queries: `within(container).getByText()` not `screen.getByText()`

## Code Standards
- Absolute imports: `@/lib/module` not `../../../module`
- No file extensions in imports: `'module'` not `'module.js'`
- kebab-case file names
- Commit frequently: max 500 lines, 5 files per commit

## Contract Enforcement (CRITICAL)
Every slice compute function MUST:
1. `assertTableColumns(conn, 'table_name', OutputSchema)`  
2. `parseAllRows(conn, 'table_name', OutputSchema)`
3. Derive manifest stats from validated data
4. `assertManifestSection(manifestPath, key, StatsSchema)`
5. Use `sha256(filePath)` for hashing

## Deployment Notes
- DuckDB usage requires route.js files with proper Next.js config (see `/api/stv-rounds`)
- Never use `git commit --no-verify`

