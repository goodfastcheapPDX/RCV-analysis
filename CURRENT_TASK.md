Title: Replace /demo routes with contest-scoped pages powered by real data

Context:
- Option A is live (single manifest + contest-namespaced artifacts).
- We need production URLs that reflect real elections/contests.
- Storybook remains for component-level demos.

Scope:
1) Routes:
   - Add app/e/[electionId]/page.tsx (election overview)
   - Add app/e/[electionId]/c/[contestId]/page.tsx (STV rounds)
   - Add app/e/[electionId]/c/[contestId]/first-choice/page.tsx
   - Remove app/demo/* and add redirects if necessary
2) Data:
   - Implement lib/manifest/contest-resolver.ts (validated read from current manifest)
   - Add small loaders: loadFirstChoiceForContest, loadStvForContest (reuse contracts)
3) Determinism/Safety:
   - runtime="nodejs" on pages that read FS
4) Tests:
   - Contract tests for resolvers (golden contest)
   - Route smoke test + snapshot for election overview
5) Docs:
   - README note on new URLs; Storybook remains for demos

Guardrails:
- Do NOT change build pipeline or manifest shape.
- Do NOT introduce new schemas; reuse existing contracts.
- No parallelization or blob changes in this task.

Done When:
- Visiting /e/<electionId> lists contests with links
- STV rounds and First-choice pages render real contest data
- All tests green; Storybook unaffected