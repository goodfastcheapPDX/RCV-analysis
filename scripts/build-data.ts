#!/usr/bin/env tsx

import { contestIdFrom, electionIdFrom } from "../src/contracts/ids";
import { ingestCvr } from "../src/packages/contracts/slices/ingest_cvr/compute";

async function main() {
  try {
    console.log("Starting multi-election CVR data ingestion...");

    // Parse command line arguments
    const args = process.argv.slice(2);
    const electionArg = args
      .find((arg) => arg.startsWith("--election="))
      ?.split("=")[1];
    const contestArg = args
      .find((arg) => arg.startsWith("--contest="))
      ?.split("=")[1];
    const srcCsvArg = args
      .find((arg) => arg.startsWith("--src-csv="))
      ?.split("=")[1];

    // Set defaults for District 2
    const srcCsv =
      srcCsvArg ||
      process.env.SRC_CSV ||
      "data/2024-11/canonical/district-2-cast-vote-record.csv";
    const electionId = (electionArg ||
      electionIdFrom({
        jurisdiction: "portland",
        date: "2024-11-05",
        kind: "gen",
      })) as any;
    const contestId = (contestArg ||
      contestIdFrom({
        districtId: "d2",
        seatCount: 3,
      })) as any;

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
