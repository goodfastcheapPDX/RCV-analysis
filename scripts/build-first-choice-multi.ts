#!/usr/bin/env tsx

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  type ContestId,
  contestIdFrom,
  type ElectionId,
  electionIdFrom,
} from "../src/contracts/ids";
import { computeFirstChoiceBreakdown } from "../src/contracts/slices/first_choice_breakdown/compute";
import { logError, loggers } from "../src/lib/logger";

interface BuildFirstChoiceMultiArgs {
  election?: string;
  contest?: string;
}

async function main() {
  try {
    loggers.script.info("Starting multi-election first choice breakdown...");

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
      })) as ElectionId;
    const contestId = (args.contest ||
      contestIdFrom({
        districtId: "d2",
        seatCount: 3,
      })) as ContestId;

    loggers.script.info(`Election: ${electionId}`);
    loggers.script.info(`Contest: ${contestId}`);

    const result = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
    });

    loggers.script.info("✅ First choice breakdown completed successfully!", {
      total_valid_ballots: result.stats.total_valid_ballots,
      candidates: result.stats.candidate_count,
      output_rows: result.data.rows,
    });
  } catch (error) {
    logError(loggers.script, error, {
      context: "❌ First choice breakdown failed",
    });
    process.exit(1);
  }
}

main();
