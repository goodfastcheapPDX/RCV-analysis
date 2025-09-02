# Codebase Structure Cleanup - Align with CLAUDE.md Rules

## Scope
Reorganize project structure to match documented conventions in CLAUDE.md:

1. **Fix slice structure**: Move `src/lib/slices/rankDistribution.ts` into proper slice at `src/packages/contracts/slices/rank_distribution_by_candidate/`
2. **Relocate test files**: Move `tests/slices/` and `tests/ui/` to be neighbors of their source files (not in separate directories)  
3. **Simplify contracts path**: Move `src/packages/contracts/` to `src/lib/contracts/`
4. **Convert to index pattern**: Transform `src/lib/manifest.ts` to `src/lib/manifest/index.ts`
5. **Update import paths**: Fix all imports affected by the reorganization
6. **Verify**: Run full test suite to ensure nothing breaks

## Done When
- [ ] All slice files follow `src/lib/contracts/slices/` pattern
- [ ] All test files are neighbors of their source files
- [ ] No files remain in standalone `tests/` directories
- [ ] All imports use correct absolute paths
- [ ] All tests pass after reorganization
- [ ] Structure matches CLAUDE.md conventions exactly

## Constraints
- Preserve all existing functionality
- Maintain contract-first architecture principles
- Keep commits small (max 500 lines, 5 files per commit)
- Each reorganization step must pass tests before proceeding