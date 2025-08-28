/// <reference types="vitest/config" />

import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    // Run tests sequentially to avoid DuckDB file locking issues
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
    // Set test timeout to 30 seconds to handle database operations
    testTimeout: 30000,
    coverage: {
      exclude: ["**/src/**/*.stories.tsx", ...coverageConfigDefaults.exclude],
      include: ["**/src/packages/**"],
      thresholds: {
        statements: 80,
        branches: 80,
      },
    },
  },
});
