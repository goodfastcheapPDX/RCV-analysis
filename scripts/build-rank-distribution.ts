#!/usr/bin/env tsx

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { computeRankDistributionByCandidate } from "../src/contracts/slices/rank_distribution_by_candidate/compute";
import { logError, loggers } from "../src/lib/logger";

interface BuildRankDistributionArgs {
  electionId: string;
  contestId: string;
  env: string;
}

async function main() {
  try {
    loggers.script.info("Building rank distribution by candidate...");

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

    loggers.script.info(`Processing: ${electionId}/${contestId} (env: ${env})`);

    const result = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

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
