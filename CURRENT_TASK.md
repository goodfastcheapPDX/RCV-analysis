API Route Testing

Context
The project has two API routes that need comprehensive test coverage to ensure reliability and proper error handling.

Scope

Create tests for existing API routes:
- `/api/manifest` - Returns manifest data
- `/api/first-choice-data` - Returns first choice breakdown data with election/contest params

Test Structure
- Use existing vitest setup and patterns
- Place tests in `src/app/api/[route]/__tests__/route.test.ts`
- Test successful responses, error cases, and edge conditions
- Mock filesystem and DuckDB where needed for isolation

Test Cases for /api/manifest:
- Successful manifest loading
- Error handling when manifest fails to load
- Response format validation

Test Cases for /api/first-choice-data:
- Successful data retrieval with default params
- Successful data retrieval with custom electionId/contestId
- 404 when parquet file doesn't exist
- Error handling for invalid election/contest combinations
- Database connection error handling
- Response format validation

Guardrails
- Follow existing test patterns in the codebase
- Use absolute imports
- Ensure tests are isolated and don't depend on external state
- Mock external dependencies (filesystem, database)

Done When
- Both API routes have comprehensive test coverage
- All tests pass
- Tests cover success cases, error cases, and edge conditions
- Tests follow project conventions