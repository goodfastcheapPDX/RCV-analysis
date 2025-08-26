#!/usr/bin/env tsx

import { computeFirstChoiceBreakdown } from "../src/packages/contracts/slices/first_choice_breakdown/compute.js";

async function main() {
  try {
    console.log("Building first choice breakdown...");
    const result = await computeFirstChoiceBreakdown();
    console.log("Build completed successfully!");
    return result;
  } catch (error) {
    console.error(
      "Build failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });
}
