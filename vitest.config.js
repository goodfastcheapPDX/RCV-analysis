import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run tests sequentially to avoid DuckDB file locking issues
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      exclude: [...coverageConfigDefaults.exclude],
      include: ["**/src/packages/**"],
      thresholds: {
        functions: 80,
        statements: 80,
        branches: 80,
        // Require that no more than 10 lines are uncovered
        lines: -10,
      },
    },
  },
});
