#!/usr/bin/env tsx

import {
  type ContestId,
  contestIdFrom,
  type ElectionId,
  electionIdFrom,
} from "../src/contracts/ids";
import { computeFirstChoiceBreakdown } from "../src/packages/contracts/slices/first_choice_breakdown/compute";
import { ingestCvr } from "../src/packages/contracts/slices/ingest_cvr/compute";
import { computeRankDistributionByCandidate } from "../src/packages/contracts/slices/rank_distribution_by_candidate/compute";

async function main() {
  try {
    console.log("Starting multi-election full pipeline...");

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
      srcCsvArg || process.env.SRC_CSV || "tests/golden/micro/cvr_small.csv";
    const electionId = (electionArg ||
      electionIdFrom({
        jurisdiction: "portland",
        date: "2024-11-05",
        kind: "gen",
      })) as ElectionId;
    const contestId = (contestArg ||
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
