#!/usr/bin/env tsx

import { existsSync } from "node:fs";
import { config as dotenv } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  type ContestId,
  contestIdFrom,
  type DistrictId,
  type ElectionId,
  electionIdFrom,
} from "@/contracts/ids";
import { computeCandidateAffinityJaccard } from "../src/contracts/slices/candidate_affinity_jaccard/compute";
import { computeCandidateAffinityMatrix } from "../src/contracts/slices/candidate_affinity_matrix/compute";
import { computeFirstChoiceBreakdown } from "../src/contracts/slices/first_choice_breakdown/compute";
import { ingestCvr } from "../src/contracts/slices/ingest_cvr/compute";
import { computeRankDistributionByCandidate } from "../src/contracts/slices/rank_distribution_by_candidate/compute";
import { computeStvRounds } from "../src/contracts/slices/stv_rounds/compute";
import { computeTransferMatrix } from "../src/contracts/slices/transfer_matrix/compute";
import { getDataEnv, validateEnv } from "../src/lib/env";

// Load environment variables based on NODE_ENV
function loadEnvironmentConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";

  // Load base .env file first
  dotenv({ path: ".env" });

  // Load environment-specific file if it exists
  const envFile = `.env.${nodeEnv}`;
  if (existsSync(envFile)) {
    console.log(`🔧 Loading environment config from ${envFile}`);
    dotenv({ path: envFile, override: true });
  } else {
    console.log(
      `🔧 Environment file ${envFile} not found, using .env defaults`,
    );
  }

  // Validate environment variables
  validateEnv();

  // Log relevant environment variables
  console.log("📋 Environment Configuration:");
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   DATA_ENV: ${process.env.DATA_ENV}`);
  console.log(`   DEBUG: ${process.env.DEBUG}`);
  console.log(`   VERBOSE: ${process.env.VERBOSE}`);
  if (process.env.SRC_CSV) {
    console.log(`   SRC_CSV: ${process.env.SRC_CSV}`);
  }
  if (process.env.DATA_BASE_URL) {
    console.log(`   DATA_BASE_URL: ${process.env.DATA_BASE_URL}`);
  }
  console.log("");
}

// Initialize environment configuration
loadEnvironmentConfig();

interface DistrictConfig {
  districtId: DistrictId;
  seatCount: number;
  csvFile: string;
}

const districts: DistrictConfig[] = [
  {
    districtId: "d1",
    seatCount: 3,
    csvFile: "data/2024-11/canonical/district-1-cast-vote-record.csv",
  },
  {
    districtId: "d2",
    seatCount: 3,
    csvFile: "data/2024-11/canonical/district-2-cast-vote-record.csv",
  },
  {
    districtId: "d3",
    seatCount: 3,
    csvFile: "data/2024-11/canonical/district-3-cast-vote-record.csv",
  },
  {
    districtId: "d4",
    seatCount: 3,
    csvFile: "data/2024-11/canonical/district-4-cast-vote-record.csv",
  },
];

async function processDistrict(district: DistrictConfig) {
  const electionId = electionIdFrom({
    jurisdiction: "portland",
    date: "2024-11-05",
    kind: "gen",
  }) as ElectionId;

  const contestId = contestIdFrom({
    districtId: district.districtId,
    seatCount: district.seatCount,
  }) as ContestId;

  const env = getDataEnv();

  console.log(`\n=== Processing ${district.districtId.toUpperCase()} ===`);
  console.log(`Contest: ${contestId}`);
  console.log(`CSV: ${district.csvFile}`);

  // Check if CSV file exists
  if (!existsSync(district.csvFile)) {
    console.log(
      `⚠️  Skipping ${district.districtId} - CSV file not found: ${district.csvFile}`,
    );
    return;
  }

  try {
    // Step 1: CVR Ingestion
    console.log(`📥 Ingesting CVR for ${district.districtId}...`);
    const ingestResult = await ingestCvr({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
      srcCsv: district.csvFile,
    });

    console.log(
      `   ✅ CVR: ${ingestResult.ballots_long.ballots} ballots, ${ingestResult.candidates.rows} candidates`,
    );

    // Step 2: First Choice Breakdown
    console.log(`📊 Computing first choice for ${district.districtId}...`);
    const firstChoiceResult = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
    });

    console.log(
      `   ✅ First Choice: ${firstChoiceResult.stats.total_valid_ballots} ballots processed`,
    );

    // Step 3: Rank Distribution by Candidate
    console.log(`📈 Computing rank distribution for ${district.districtId}...`);
    const rankDistResult = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    console.log(
      `   ✅ Rank Distribution: ${rankDistResult.stats.candidate_count} candidates × ${rankDistResult.stats.max_rank} ranks (${rankDistResult.data.rows} rows)`,
    );

    // Step 4: STV Rounds
    console.log(`🗳️  Computing STV rounds for ${district.districtId}...`);
    const stvResult = await computeStvRounds({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
    });

    console.log(
      `   ✅ STV: ${stvResult.winners.length} winners elected from ${stvResult.seats} seats in ${stvResult.number_of_rounds} rounds`,
    );

    // Step 5: Transfer Matrix
    console.log(`🔄 Computing transfer matrix for ${district.districtId}...`);
    const transferResult = await computeTransferMatrix({
      election_id: electionId,
      contest_id: contestId,
      district_id: district.districtId,
      seat_count: district.seatCount,
    });

    console.log(
      `   ✅ Transfers: ${transferResult.stats.total_transfers} transfers (${transferResult.stats.elimination_transfers} elimination, ${transferResult.stats.surplus_transfers} surplus)`,
    );

    // Step 6: Candidate Affinity Matrix
    console.log(
      `🤝 Computing candidate affinity matrix for ${district.districtId}...`,
    );
    const affinityResult = await computeCandidateAffinityMatrix({
      electionId,
      contestId,
      env,
    });

    console.log(
      `   ✅ Affinity: ${affinityResult.stats.unique_pairs} pairs from ${affinityResult.stats.total_ballots_considered} ballots (max: ${(affinityResult.stats.max_pair_frac * 100).toFixed(1)}%)`,
    );

    // Step 7: Candidate Affinity Jaccard Matrix
    console.log(
      `🔍 Computing candidate affinity jaccard for ${district.districtId}...`,
    );
    const jaccardResult = await computeCandidateAffinityJaccard({
      electionId,
      contestId,
      env,
    });
    console.log(
      `   ✅ Jaccard: ${jaccardResult.stats.unique_pairs} pairs (max: ${(jaccardResult.stats.max_jaccard * 100).toFixed(1)}%, zeros: ${jaccardResult.stats.zero_union_pairs})`,
    );
  } catch (error) {
    console.error(`   ❌ Failed to process ${district.districtId}:`);
    console.error(
      `     ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

interface BuildAllDistrictsArgs {
  skipOnError?: boolean;
}

async function main() {
  try {
    console.log("🚀 Building all Portland districts for 2024 General Election");

    const env = getDataEnv();

    const args = yargs(hideBin(process.argv))
      .scriptName("build-all-districts")
      .usage("Build election data for all Portland districts")
      .option("skip-on-error", {
        type: "boolean",
        description: "Continue processing remaining districts if one fails",
        default: false,
      })
      .help()
      .strict()
      .parseSync() as BuildAllDistrictsArgs;

    const skipOnError = args.skipOnError;

    let successful = 0;
    let failed = 0;

    for (const district of districts) {
      try {
        await processDistrict(district);
        successful++;
      } catch (error) {
        failed++;
        if (!skipOnError) {
          throw error;
        }
        console.log(`   ⏭️  Continuing with next district...`);
      }
    }

    console.log(`\n🎉 Multi-district processing complete!`);
    console.log(`   ✅ Successful: ${successful} districts`);
    console.log(`   ❌ Failed: ${failed} districts`);
    console.log(`   📂 Data structure: data/${env}/portland-20241105-gen/*/`);

    if (failed > 0 && !skipOnError) {
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Multi-district processing failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
