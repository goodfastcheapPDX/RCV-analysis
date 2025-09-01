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
import { validateEnv } from "../src/lib/env";
import { ingestCvr } from "../src/packages/contracts/slices/ingest_cvr/compute";

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
  try {
    console.log("Starting multi-election CVR data ingestion...");

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

    console.log(`Data Environment: ${process.env.DATA_ENV}`);

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

    console.log(`Election: ${electionId}`);
    console.log(`Contest: ${contestId}`);
    console.log(`Source CSV: ${srcCsv}`);

    const result = await ingestCvr({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
      srcCsv,
    });

    console.log("✅ Data ingestion completed successfully!");
    console.log(`📊 Statistics:`);
    console.log(`  - Candidates: ${result.candidates.rows}`);
    console.log(`  - Ballots: ${result.ballots_long.ballots}`);
    console.log(`  - Total vote records: ${result.ballots_long.rows}`);
    console.log(
      `  - Rank range: ${result.ballots_long.min_rank}-${result.ballots_long.max_rank}`,
    );
  } catch (error) {
    console.error("❌ Data ingestion failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
