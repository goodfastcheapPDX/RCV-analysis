#!/usr/bin/env tsx

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  type ContestId,
  contestIdFrom,
  type ElectionId,
  electionIdFrom,
} from "../src/contracts/ids";
import { computeFirstChoiceBreakdown } from "../src/packages/contracts/slices/first_choice_breakdown/compute";
import { ingestCvr } from "../src/packages/contracts/slices/ingest_cvr/compute";
import { computeRankDistributionByCandidate } from "../src/packages/contracts/slices/rank_distribution_by_candidate/compute";

interface BuildPipelineArgs {
  election?: string;
  contest?: string;
  srcCsv?: string;
}

async function main() {
  try {
    console.log("Starting multi-election full pipeline...");

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
      .help()
      .strict()
      .parseSync() as BuildPipelineArgs;

    // Set defaults for District 2
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

    console.log(`Election: ${electionId}`);
    console.log(`Contest: ${contestId}`);
    console.log(`Source CSV: ${srcCsv}`);
    console.log();

    // Step 1: Ingest CVR
    console.log("=== Step 1: CVR Ingestion ===");
    const ingestResult = await ingestCvr({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
      srcCsv,
    });

    console.log(`✅ CVR ingestion completed:`);
    console.log(`  - Candidates: ${ingestResult.candidates.rows}`);
    console.log(`  - Ballots: ${ingestResult.ballots_long.ballots}`);
    console.log(`  - Total vote records: ${ingestResult.ballots_long.rows}`);
    console.log();

    // Step 2: First Choice Breakdown
    console.log("=== Step 2: First Choice Breakdown ===");
    const firstChoiceResult = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: "d2",
      seatCount: 3,
    });

    console.log(`✅ First choice breakdown completed:`);
    console.log(
      `  - Total valid ballots: ${firstChoiceResult.stats.total_valid_ballots}`,
    );
    console.log(`  - Candidates: ${firstChoiceResult.stats.candidate_count}`);
    console.log(`  - Output rows: ${firstChoiceResult.data.rows}`);
    console.log();

    // Step 3: Rank Distribution by Candidate
    console.log("=== Step 3: Rank Distribution by Candidate ===");
    const rankDistResult = await computeRankDistributionByCandidate({
      electionId,
      contestId,
    });

    console.log(`✅ Rank distribution by candidate completed:`);
    console.log(`  - Max rank: ${rankDistResult.stats.max_rank}`);
    console.log(`  - Total ballots: ${rankDistResult.stats.total_ballots}`);
    console.log(`  - Candidates: ${rankDistResult.stats.candidate_count}`);
    console.log(
      `  - Zero-rank candidates: ${rankDistResult.stats.zero_rank_candidates}`,
    );
    console.log(`  - Output rows: ${rankDistResult.data.rows}`);
    console.log();

    console.log("🎉 Full pipeline completed successfully!");
    console.log(
      `📂 Artifacts created under: data/dev/${electionId}/${contestId}/`,
    );
  } catch (error) {
    console.error("❌ Pipeline failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
