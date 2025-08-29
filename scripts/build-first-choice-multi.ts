#!/usr/bin/env tsx

import { contestIdFrom, electionIdFrom } from "../src/contracts/ids";
import { computeFirstChoiceBreakdown } from "../src/packages/contracts/slices/first_choice_breakdown/compute";

async function main() {
  try {
    console.log("Starting multi-election first choice breakdown...");

    // Parse command line arguments
    const args = process.argv.slice(2);
    const electionArg = args
      .find((arg) => arg.startsWith("--election="))
      ?.split("=")[1];
    const contestArg = args
      .find((arg) => arg.startsWith("--contest="))
      ?.split("=")[1];

    // Set defaults for District 2
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

    const result = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
    });

    console.log("✅ First choice breakdown completed successfully!");
    console.log(`📊 Statistics:`);
    console.log(`  - Total valid ballots: ${result.stats.total_valid_ballots}`);
    console.log(`  - Candidates: ${result.stats.candidate_count}`);
    console.log(`  - Output rows: ${result.data.rows}`);
  } catch (error) {
    console.error("❌ First choice breakdown failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
