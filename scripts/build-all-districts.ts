#!/usr/bin/env tsx

import { ingestCvr } from "../src/packages/contracts/slices/ingest_cvr/compute";
import { computeFirstChoiceBreakdown } from "../src/packages/contracts/slices/first_choice_breakdown/compute";
import { electionIdFrom, contestIdFrom, type ElectionId, type ContestId, type DistrictId } from "@/contracts/ids";
import { existsSync } from "fs";

interface DistrictConfig {
  districtId: DistrictId;
  seatCount: number;
  csvFile: string;
}

const districts: DistrictConfig[] = [
  { 
    districtId: 'd1', 
    seatCount: 3, 
    csvFile: 'data/2024-11/canonical/district-1-cast-vote-record.csv' 
  },
  { 
    districtId: 'd2', 
    seatCount: 3, 
    csvFile: 'data/2024-11/canonical/district-2-cast-vote-record.csv' 
  },
  { 
    districtId: 'd3', 
    seatCount: 3, 
    csvFile: 'data/2024-11/canonical/district-3-cast-vote-record.csv' 
  },
  { 
    districtId: 'd4', 
    seatCount: 3, 
    csvFile: 'data/2024-11/canonical/district-4-cast-vote-record.csv' 
  },
];

async function processDistrict(district: DistrictConfig) {
  const electionId = electionIdFrom({
    jurisdiction: 'portland',
    date: '2024-11-05',
    kind: 'gen'
  }) as ElectionId;
  
  const contestId = contestIdFrom({
    districtId: district.districtId,
    seatCount: district.seatCount
  }) as ContestId;

  console.log(`\n=== Processing ${district.districtId.toUpperCase()} ===`);
  console.log(`Contest: ${contestId}`);
  console.log(`CSV: ${district.csvFile}`);

  // Check if CSV file exists
  if (!existsSync(district.csvFile)) {
    console.log(`⚠️  Skipping ${district.districtId} - CSV file not found: ${district.csvFile}`);
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

    console.log(`   ✅ CVR: ${ingestResult.ballots_long.ballots} ballots, ${ingestResult.candidates.rows} candidates`);

    // Step 2: First Choice Breakdown  
    console.log(`📊 Computing first choice for ${district.districtId}...`);
    const firstChoiceResult = await computeFirstChoiceBreakdown({
      electionId,
      contestId,
      districtId: district.districtId,
      seatCount: district.seatCount,
    });

    console.log(`   ✅ First Choice: ${firstChoiceResult.stats.total_valid_ballots} ballots processed`);

  } catch (error) {
    console.error(`   ❌ Failed to process ${district.districtId}:`);
    console.error(`     ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function main() {
  try {
    console.log("🚀 Building all Portland districts for 2024 General Election");
    
    const args = process.argv.slice(2);
    const skipOnError = args.includes('--skip-on-error');
    
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
    console.log(`   📂 Data structure: data/dev/portland-20241105-gen/*/`);

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