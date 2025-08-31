#!/usr/bin/env tsx

import { computeRankDistributionByCandidate } from "../src/packages/contracts/slices/rank_distribution_by_candidate/compute";

async function main() {
  try {
    console.log("Building rank distribution by candidate...");

    // Parse command line arguments for flexibility
    const args = process.argv.slice(2);
    const electionId = args[0] || "portland-20241105-gen";
    const contestId = args[1] || "d2-3seat";
    const env = args[2] || "dev";

    console.log(`Processing: ${electionId}/${contestId} (env: ${env})`);

    const result = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

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
