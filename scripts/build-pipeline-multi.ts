#!/usr/bin/env tsx

import { config as dotenv } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  type ContestId,
  contestIdFrom,
  type ElectionId,
  electionIdFrom,
} from "../src/contracts/ids";
import { computeFirstChoiceBreakdown } from "../src/contracts/slices/first_choice_breakdown/compute";
import { ingestCvr } from "../src/contracts/slices/ingest_cvr/compute";
import { computeRankDistributionByCandidate } from "../src/contracts/slices/rank_distribution_by_candidate/compute";
import { getDataEnv, validateEnv } from "../src/lib/env";
import { logError, loggers } from "../src/lib/logger";

// Load environment variables and validate
dotenv();
validateEnv();

interface BuildPipelineArgs {
  election?: string;
  contest?: string;
  srcCsv?: string;
  dataEnv?: "dev" | "test" | "prod";
}

async function main() {
  try {
    loggers.script.info("Starting multi-election full pipeline...");

    const args = yargs(hideBin(process.argv))
      .scriptName("build-pipeline-multi")
      .usage("Run full election data processing pipeline")
      .option("election", {
        type: "string",
        description: "Election ID override",
        alias: "e",
      })
      .option("contest", {
        type: "string",
        description: "Contest ID override",
        alias: "c",
      })
      .option("src-csv", {
        type: "string",
        description: "Source CSV file path",
        alias: "s",
      })
      .option("data-env", {
        type: "string",
        description: "Data environment (dev, test, prod)",
        choices: ["dev", "test", "prod"],
        default: process.env.NODE_ENV === "production" ? "prod" : "dev",
        alias: "d",
      })
      .help()
      .strict()
      .parseSync() as BuildPipelineArgs;

    // Override DATA_ENV if specified via command line
    if (args.dataEnv) {
      process.env.DATA_ENV = args.dataEnv;
    }

    loggers.script.info(`Data Environment: ${process.env.DATA_ENV}`);

    // Set defaults for District 2 (using type-safe environment variables)
    const srcCsv =
      args.srcCsv || process.env.SRC_CSV || "tests/golden/micro/cvr_small.csv";
    const electionId = (args.election ||
      electionIdFrom({
        jurisdiction: "portland",
        date: "2024-11-05",
        kind: "gen",
      })) as ElectionId;
    const contestId = (args.contest ||
      contestIdFrom({
        districtId: "d2",
        seatCount: 3,
      })) as ContestId;

    loggers.script.info(`Election: ${electionId}`);
    loggers.script.info(`Contest: ${contestId}`);
    loggers.script.info(`Source CSV: ${srcCsv}`);
    loggers.script.info("");

    // Step 1: Ingest CVR
    loggers.script.info("=== Step 1: CVR Ingestion ===");
    const ingestResult = await ingestCvr({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
      srcCsv,
    });

    loggers.script.info(`✅ CVR ingestion completed:`, {
      candidates: ingestResult.candidates.rows,
      ballots: ingestResult.ballots_long.ballots,
      total_vote_records: ingestResult.ballots_long.rows,
    });

    // Step 2: First Choice Breakdown
    loggers.script.info("=== Step 2: First Choice Breakdown ===");
    const firstChoiceResult = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
    });

    loggers.script.info(`✅ First choice breakdown completed:`);
    loggers.script.info(`First choice breakdown details:`, {
      total_valid_ballots: firstChoiceResult.stats.total_valid_ballots,
      candidates: firstChoiceResult.stats.candidate_count,
      output_rows: firstChoiceResult.data.rows,
    });

    // Step 3: Rank Distribution by Candidate
    loggers.script.info("=== Step 3: Rank Distribution by Candidate ===");
    const rankDistResult = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env: getDataEnv(),
    });

    loggers.script.info(`✅ Rank distribution by candidate completed:`);
    loggers.script.info(`  - Max rank: ${rankDistResult.stats.max_rank}`);
    loggers.script.info(
      `  - Total ballots: ${rankDistResult.stats.total_ballots}`,
    );
    loggers.script.info(
      `  - Candidates: ${rankDistResult.stats.candidate_count}`,
    );
    loggers.script.info(
      `  - Zero-rank candidates: ${rankDistResult.stats.zero_rank_candidates}`,
    );
    loggers.script.info(`  - Output rows: ${rankDistResult.data.rows}`);
    loggers.script.info("");

    loggers.script.info("🎉 Full pipeline completed successfully!");
    loggers.script.info(
      `📂 Artifacts created under: data/dev/${electionId}/${contestId}/`,
    );
  } catch (error) {
    logError(loggers.script, error, { context: "Pipeline failed" });
    process.exit(1);
  }
}

main();
