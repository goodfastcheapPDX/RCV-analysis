#!/usr/bin/env tsx

import { computeFirstChoiceBreakdown } from "../src/contracts/slices/first_choice_breakdown/compute";
import { logError, loggers } from "../src/lib/logger";

async function main() {
  try {
    loggers.script.info("Building first choice breakdown...");
    const result = await computeFirstChoiceBreakdown();
    loggers.script.info("Build completed successfully!");
    return result;
  } catch (error) {
    logError(loggers.script, error, { context: "Build failed" });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logError(loggers.script, error, { context: "Script error" });
    process.exit(1);
  });
}
