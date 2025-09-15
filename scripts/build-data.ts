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
import { ingestCvr } from "../src/contracts/slices/ingest_cvr/compute";
import { validateEnv } from "../src/lib/env";
import { createTimer, logError, loggers } from "../src/lib/logger";

// Load environment variables and validate
dotenv();
validateEnv();

interface BuildDataArgs {
  election?: string;
  contest?: string;
  srcCsv?: string;
  dataEnv?: "dev" | "test" | "prod";
}

async function main() {
  const timer = createTimer(loggers.build, "CVR data ingestion");

  try {
    loggers.build.info("Starting multi-election CVR data ingestion...");

    const args = yargs(hideBin(process.argv))
      .scriptName("build-data")
      .usage("Build CVR data for elections")
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
      .parseSync() as BuildDataArgs;

    // Override DATA_ENV if specified via command line
    if (args.dataEnv) {
      process.env.DATA_ENV = args.dataEnv;
    }

    loggers.build.info("Configuration", {
      dataEnvironment: process.env.DATA_ENV,
    });

    // Set defaults for District 2 (using type-safe environment variables)
    const srcCsv =
      args.srcCsv ||
      process.env.SRC_CSV ||
      "data/2024-11/canonical/district-2-cast-vote-record.csv";
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

    loggers.build.info("Input parameters", {
      election: electionId,
      contest: contestId,
      sourceCSV: srcCsv,
    });

    const result = await ingestCvr({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
      srcCsv,
    });

    timer.end({
      candidates: result.candidates.rows,
      ballots: result.ballots_long.ballots,
      totalRecords: result.ballots_long.rows,
    });

    loggers.build.info("✅ Data ingestion completed successfully!");
    loggers.build.info("📊 Statistics", {
      candidates: result.candidates.rows,
      ballots: result.ballots_long.ballots,
      totalVoteRecords: result.ballots_long.rows,
      rankRange: `${result.ballots_long.min_rank}-${result.ballots_long.max_rank}`,
    });
  } catch (error) {
    logError(loggers.build, error, { operation: "data ingestion" });
    process.exit(1);
  }
}

main();
