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
import { computeCandidateAffinityProximity } from "../src/contracts/slices/candidate_affinity_proximity/compute";
import { computeFirstChoiceBreakdown } from "../src/contracts/slices/first_choice_breakdown/compute";
import { ingestCvr } from "../src/contracts/slices/ingest_cvr/compute";
import { computeRankDistributionByCandidate } from "../src/contracts/slices/rank_distribution_by_candidate/compute";
import { computeStvRounds } from "../src/contracts/slices/stv_rounds/compute";
import { computeTransferMatrix } from "../src/contracts/slices/transfer_matrix/compute";
import { getDataEnv, validateEnv } from "../src/lib/env";
import { createTimer, logError, loggers } from "../src/lib/logger";

// Load environment variables based on NODE_ENV
function loadEnvironmentConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";

  // Load base .env file first
  dotenv({ path: ".env" });

  // Load environment-specific file if it exists
  const envFile = `.env.${nodeEnv}`;
  if (existsSync(envFile)) {
    loggers.script.info(`🔧 Loading environment config from ${envFile}`);
    dotenv({ path: envFile, override: true });
  } else {
    loggers.script.info(
      `🔧 Environment file ${envFile} not found, using .env defaults`,
    );
  }

  // Validate environment variables
  validateEnv();

  // Log relevant environment variables
  loggers.script.info("📋 Environment Configuration", {
    NODE_ENV: process.env.NODE_ENV,
    DATA_ENV: process.env.DATA_ENV,
    DEBUG: process.env.DEBUG,
    VERBOSE: process.env.VERBOSE,
    SRC_CSV: process.env.SRC_CSV,
    DATA_BASE_URL: process.env.DATA_BASE_URL,
  });
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

  const timer = createTimer(
    loggers.build,
    `Processing ${district.districtId.toUpperCase()}`,
  );

  loggers.build.info(
    `=== Processing ${district.districtId.toUpperCase()} ===`,
    {
      contest: contestId,
      csvFile: district.csvFile,
      districtId: district.districtId,
      seatCount: district.seatCount,
    },
  );

  // Check if CSV file exists
  if (!existsSync(district.csvFile)) {
    loggers.build.warn(
      `⚠️  Skipping ${district.districtId} - CSV file not found`,
      {
        districtId: district.districtId,
        csvFile: district.csvFile,
      },
    );
    return;
  }

  try {
    // Step 1: CVR Ingestion
    loggers.build.info(`📥 Ingesting CVR for ${district.districtId}...`);
    const ingestResult = await ingestCvr({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
      srcCsv: district.csvFile,
    });

    loggers.build.info(`   ✅ CVR ingestion completed`, {
      districtId: district.districtId,
      ballots: ingestResult.ballots_long.ballots,
      candidates: ingestResult.candidates.rows,
    });

    // Step 2: First Choice Breakdown
    loggers.build.info(
      `📊 Computing first choice for ${district.districtId}...`,
    );
    const firstChoiceResult = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
    });

    loggers.build.info(`   ✅ First Choice completed`, {
      districtId: district.districtId,
      validBallots: firstChoiceResult.stats.total_valid_ballots,
    });

    // Step 3: Rank Distribution by Candidate
    loggers.build.info(
      `📈 Computing rank distribution for ${district.districtId}...`,
    );
    const rankDistResult = await computeRankDistributionByCandidate({
      electionId,
      contestId,
      env,
    });

    loggers.build.info(`   ✅ Rank Distribution completed`, {
      districtId: district.districtId,
      candidateCount: rankDistResult.stats.candidate_count,
      maxRank: rankDistResult.stats.max_rank,
      rows: rankDistResult.data.rows,
    });

    // Step 4: STV Rounds
    loggers.build.info(`🗳️  Computing STV rounds for ${district.districtId}...`);
    const stvResult = await computeStvRounds({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
    });

    loggers.build.info(`   ✅ STV completed`, {
      districtId: district.districtId,
      winners: stvResult.winners.length,
      seats: stvResult.seats,
      rounds: stvResult.number_of_rounds,
    });

    // Step 5: Transfer Matrix
    loggers.build.info(
      `🔄 Computing transfer matrix for ${district.districtId}...`,
    );
    const transferResult = await computeTransferMatrix({
      election_id: electionId,
      contest_id: contestId,
      district_id: district.districtId,
      seat_count: district.seatCount,
    });

    loggers.build.info(`   ✅ Transfer Matrix completed`, {
      districtId: district.districtId,
      totalTransfers: transferResult.stats.total_transfers,
      eliminationTransfers: transferResult.stats.elimination_transfers,
      surplusTransfers: transferResult.stats.surplus_transfers,
    });

    // Step 6: Candidate Affinity Matrix
    loggers.build.info(
      `🤝 Computing candidate affinity matrix for ${district.districtId}...`,
    );
    const affinityResult = await computeCandidateAffinityMatrix({
      electionId,
      contestId,
      env,
    });

    loggers.build.info(`   ✅ Candidate Affinity completed`, {
      districtId: district.districtId,
      uniquePairs: affinityResult.stats.unique_pairs,
      totalBallotsConsidered: affinityResult.stats.total_ballots_considered,
      maxPairPercentage: (affinityResult.stats.max_pair_frac * 100).toFixed(1),
    });

    // Step 7: Candidate Affinity Jaccard Matrix
    loggers.build.info(
      `🔍 Computing candidate affinity jaccard for ${district.districtId}...`,
    );
    const jaccardResult = await computeCandidateAffinityJaccard({
      electionId,
      contestId,
      env,
    });
    loggers.build.info(`   ✅ Jaccard completed`, {
      districtId: district.districtId,
      uniquePairs: jaccardResult.stats.unique_pairs,
      maxJaccardPercentage: (jaccardResult.stats.max_jaccard * 100).toFixed(1),
      zeroUnionPairs: jaccardResult.stats.zero_union_pairs,
    });

    // Step 8: Candidate Affinity Proximity Matrix
    loggers.build.info(
      `📏 Computing candidate affinity proximity for ${district.districtId}...`,
    );
    const proximityResult = await computeCandidateAffinityProximity({
      electionId,
      contestId,
      env,
    });
    loggers.build.info(`   ✅ Proximity completed`, {
      districtId: district.districtId,
      uniquePairs: proximityResult.stats.unique_pairs,
      maxWeightSum: proximityResult.stats.max_weight_sum.toFixed(2),
      alpha: proximityResult.stats.alpha,
    });

    timer.end({
      districtId: district.districtId,
      totalSteps: 8,
    });
  } catch (error) {
    logError(loggers.build, error, {
      operation: `district processing`,
      districtId: district.districtId,
      csvFile: district.csvFile,
    });
    throw error;
  }
}

interface BuildAllDistrictsArgs {
  skipOnError?: boolean;
}

async function main() {
  const mainTimer = createTimer(
    loggers.script,
    "Building all Portland districts",
  );

  try {
    loggers.script.info(
      "🚀 Building all Portland districts for 2024 General Election",
    );

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
        loggers.script.info(`   ⏭️  Continuing with next district...`);
      }
    }

    loggers.script.info(`\n🎉 Multi-district processing complete!`);
    loggers.script.info(`   ✅ Successful: ${successful} districts`);
    loggers.script.info(`   ❌ Failed: ${failed} districts`);
    loggers.script.info(
      `   📂 Data structure: data/${env}/portland-20241105-gen/*/`,
    );

    mainTimer.end({
      successful_districts: successful,
      failed_districts: failed,
    });

    if (failed > 0 && !skipOnError) {
      process.exit(1);
    }
  } catch (error) {
    logError(loggers.script, error, {
      context: "💥 Multi-district processing failed",
    });
    process.exit(1);
  }
}

main();
