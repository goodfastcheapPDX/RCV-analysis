#!/usr/bin/env tsx

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { contestIdFrom, electionIdFrom } from "../src/contracts/ids";
import { computeFirstChoiceBreakdown } from "../src/packages/contracts/slices/first_choice_breakdown/compute";

interface BuildFirstChoiceMultiArgs {
  election?: string;
  contest?: string;
}

async function main() {
  try {
    console.log("Starting multi-election first choice breakdown...");

    const args = yargs(hideBin(process.argv))
      .scriptName("build-first-choice-multi")
      .usage("Build first choice breakdown data for elections")
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
      .help()
      .strict()
      .parseSync() as BuildFirstChoiceMultiArgs;

    // Set defaults for District 2
    const electionId = (args.election ||
      electionIdFrom({
        jurisdiction: "portland",
        date: "2024-11-05",
        kind: "gen",
      })) as any;
    const contestId = (args.contest ||
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
