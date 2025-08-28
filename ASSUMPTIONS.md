# Stage 0a Assumptions

- **IDs are kebab-case and stable across builds**
- **DATA_ENV is read-only context selection (dev|test|prod), not a write target**
- **v1 resolver maps to current flat files under /data/<env>**
- **v2 will switch to /data/<env>/processed/{electionId}/{contestId}/... with no page changes**
- **buildId is a short hex SHA used for future ?v= pinning (not enforced in 0a)**