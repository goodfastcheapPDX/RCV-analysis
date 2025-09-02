#!/usr/bin/env tsx

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { computeRankDistributionByCandidate } from "../src/packages/contracts/slices/rank_distribution_by_candidate/compute";

interface BuildRankDistributionArgs {
  electionId: string;
  contestId: string;
  env: string;
}

async function main() {
  try {
    console.log("Building rank distribution by candidate...");

    const args = yargs(hideBin(process.argv))
      .scriptName("build-rank-distribution")
      .usage("Build rank distribution data for a specific contest")
      .option("electionId", {
        type: "string",
        description: "Election ID",
        default: "portland-20241105-gen",
      })
      .option("contestId", {
        type: "string",
        description: "Contest ID",
        default: "d2-3seat",
      })
      .option("env", {
        type: "string",
        description: "Environment (dev, prod, test)",
        default: process.env.DATA_ENV || "dev",
        choices: ["dev", "prod", "test"],
      })
      .help()
      .strict()
      .parseSync() as BuildRankDistributionArgs;

    const { electionId, contestId, env } = args;

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
