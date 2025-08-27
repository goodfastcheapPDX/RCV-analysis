#!/usr/bin/env tsx

import { getArtifactPaths } from "../src/packages/contracts/lib/artifact-paths";
import { ingestCvr } from "../src/packages/contracts/slices/ingest_cvr/compute";

async function main() {
  try {
    console.log("Starting CVR data ingestion...");

    // Set default CSV path if not provided
    if (!process.env.SRC_CSV) {
      process.env.SRC_CSV =
        "data/2024-11/canonical/district-2-cast-vote-record.csv";
    }

    console.log(`Processing CSV: ${process.env.SRC_CSV}`);

    const result = await ingestCvr();

    const paths = getArtifactPaths();

    console.log("✅ Data ingestion completed successfully!");
    console.log(`📊 Statistics:`);
    console.log(`  - Candidates: ${result.candidates.rows}`);
    console.log(`  - Ballots: ${result.ballots_long.ballots}`);
    console.log(`  - Total vote records: ${result.ballots_long.rows}`);
    console.log(
      `  - Rank range: ${result.ballots_long.min_rank}-${result.ballots_long.max_rank}`,
    );
    console.log(
      `  - Duplicate ballots: ${result.ballots_long.duplicate_ballots}`,
    );

    console.log("\n📁 Files created:");
    console.log(`  - ${paths.ingest.candidates}`);
    console.log(`  - ${paths.ingest.ballotsLong}`);
    console.log(`  - ${paths.manifest} (updated)`);
  } catch (error) {
    console.error("❌ Data ingestion failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
