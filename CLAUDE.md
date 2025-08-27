# Ranked Elections Analyzer

A comprehensive analysis platform for ranked-choice voting elections, featuring Single Transferable Vote (STV) tabulation, coalition analysis, and interactive visualizations.

## Development Rules

- src\packages\contracts\lib\contract-enforcer.ts is always the single source of truth for any downstream code that interacts with data structures
- your current task is always described in CURRENT_TASK.md. if it is empty it means we must define the task together before proceeding.
- never work beyond the scope of CURRENT_TASK.md
- never update CURRENT_TASK.md without explicit instruction to do so
`git commit --no-verify` is never allowed. do not use the `--no-verify` option with any git command, ever, for any reason. there will be profound consequences if you do. if an attempted commit results in significant errors outside the scope of the current work, that's fine. just incorporate those fixes into the current work. treat them as a top priority.
- use absolute import paths throughout the project. `import Module from '@/src/lib/Module'` as opposed to `import Module from '../../lib/Module'` for example
- stop and commit frequently as you make progress. a git commit should accompany at least every individual task or todo you complete. it is better to have too many commits than too few. the more often you commit, the less likely you are to run into unrelated failures and issues

fix issues as they arise, commit often to surface the issues quickly.

- do not comment out or delete tests just to get commit hooks to succeed. failing tests should always be resolved before proceeding.
- every commit requires a 100% passing test run. do not consider work done if any test is failing. if a failing test is unrelated, solve that problem before proceeding
- mocks cause more trouble than they're worth. use in memory database setups and dependency injection where necessary rather than building mock objects for tests.

**Mathematical Accuracy**: This is electoral analysis - mathematical correctness is critical. Use existing validation patterns and add appropriate tests.

**User Experience**: This platform serves researchers, campaigns, and citizens. Maintain the educational approach with clear explanations and interactive guidance.

### Contract-First Architecture

**CRITICAL**: This project uses a contract-first approach where Zod schemas are the single source of truth for all data structures. Every slice must enforce runtime validation.

**Mandatory Contract Enforcement**: Every slice compute function MUST:
1. Call `assertTableColumns(conn, 'table_name', OutputSchema)` before exporting artifacts
2. Use `parseAllRows(conn, 'table_name', OutputSchema)` to validate ALL data through Zod
3. Derive manifest stats from validated parsed data (not separate SQL queries)
4. Call `assertManifestSection(manifestPath, key, StatsSchema)` after manifest update
5. Use `sha256(filePath)` from contract-enforcer for deterministic hashing

**If contract enforcement is skipped, the build MUST fail.** This prevents schema drift and ensures data integrity.

**Guardrails for Contract Enforcement**:
- Import contract enforcer utilities: `import { assertTableColumns, parseAllRows, assertManifestSection, sha256 } from "../../lib/contract-enforcer.js"`
- Define `Output`, `Stats`, and `Data` schemas in index.contract.ts following naming convention
- Use `.nonnegative()` instead of `.min(0)` and `.positive()` instead of `.min(1)` for clarity
- Always validate before export: if validation fails, STOP and print diagnostic
- Stats must be derived from validated parsed rows, not separate SQL

* Every task: one **vertical slice** = contract + SQL + compute + view + story + manifest + tests.
* Guardrails prevent scope creep and thrash.

Universal "kickoff" wrapper (prepend to any prompt): **You are implementing ONE feature slice end-to-end. Do not change any unrelated files. Follow "Scope" and "Done When" exactly. If you hit blockers, stop and print a short diagnostic + proposed next step.**

## Project Overview

This project analyzes election data from Portland City Council District 2 elections using Cast Vote Record (CVR) data in CSV format. The system provides comprehensive tools for understanding ranked-choice voting patterns, candidate coalitions, and vote transfer dynamics in multi-winner elections.

### Key Features

- **STV Tabulation Engine**: PyRankVote-based implementation with exact winner verification
- **Coalition Analysis**: Mathematical analysis of candidate relationships and voter behavior
- **Interactive Visualizations**: Network graphs, Sankey diagrams, and detailed vote flow tracking
- **Web Dashboard**: FastAPI-based interface with real-time analysis
- **Comprehensive Testing**: Production-grade test infrastructure with golden datasets

## Data Structure

The repository contains election data files:
- **CVR Format**: Cast Vote Records with ballot information and candidate rankings (1-6 ranks per candidate)
- **Multi-winner Election**: 22 named candidates plus write-in options for a 3-winner election
- **Data Volume**: 332,969+ ballot records for comprehensive analysis

### CVR Data Format

The CSV files contain these key columns:
- `RowNumber`, `BoxID`, `BoxPosition`, `BallotID`: Ballot identification
- `PrecinctID`, `BallotStyleID`, `PrecinctStyleName`: Location information
- `Choice_X_1:City of Portland, Councilor, District 2:Y:Number of Winners 3:[Candidate Name]:NON`: Ranking data
  - X = Choice ID number (36-57, plus write-in IDs)
  - Y = Rank position (1-6)
  - Values are 1 for selected rank, 0 for not selected

## Data Analysis Considerations

When working with this election data:

1. **Multi-winner RCV**: This is a 3-winner ranked-choice election, requiring different tabulation algorithms than single-winner RCV
2. **Candidate Management**: 22 named candidates plus multiple write-in categories
3. **Ranking Structure**: Voters can rank up to 6 preferences per candidate
4. **Data Volume**: Files contain 50k+ ballot records for analysis

