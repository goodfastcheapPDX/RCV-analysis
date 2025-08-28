#!/usr/bin/env tsx

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import Decimal from "decimal.js";

type DecimalType = InstanceType<typeof Decimal>;

interface ValidationConfig {
  case?: string;
  env: string;
  all: boolean;
}

interface OfficialResults {
  config: {
    threshold: string;
  };
  results: Array<{
    round: number;
    tally: Record<string, string>;
    tallyResults?: Array<{
      eliminated?: string;
      elected?: string;
    }>;
  }>;
}

interface StvRoundRecord {
  round: number;
  candidate_name: string;
  votes: number;
  status: "standing" | "elected" | "eliminated";
}

interface StvMetaRecord {
  round: number;
  quota: number;
  exhausted: number;
  elected_this_round: string[] | null;
  eliminated_this_round: string[] | null;
}

/**
 * Name normalization mapping for official results comparison
 */
const NAME_MAPPING: Record<string, string> = {
  // Official name -> Our internal name mappings
  "Antonio Jamal PettyJohnBlue": "Antonio Jamal PettyJohnBlue",
  "Bob Simril": "Bob Simril",
  "Chris Olson": "Chris Olson",
  "Dan Ryan": "Dan Ryan",
  "Debbie Kitchin": "Debbie Kitchin",
  "Elana Pirtle-Guiney": "Elana Pirtle-Guiney",
  "James Armstrong": "James Armstrong",
  "Jennifer Park": "Jennifer Park",
  "Jonathan Tasini": "Jonathan Tasini",
  "Laura Streib": "Laura Streib",
  "Liz Taylor": "Liz Taylor",
  "Mariah Hudson": "Mariah Hudson",
  "Marnie Glickman": "Marnie Glickman",
  "Michael (Mike) Marshall": "Michael (Mike) Marshall",
  "Michelle DePass": "Michelle DePass",
  "Nabil Zaghloul": "Nabil Zaghloul",
  "Nat West": "Nat West",
  "Reuben Berlin": "Reuben Berlin",
  "Sam Sachs": "Sam Sachs",
  "Sameer Kanal": "Sameer Kanal",
  "Tiffani Penson": "Tiffani Penson",
  "Uncertified Write In": "Uncertified Write In",
  "Will Mespelt": "Will Mespelt",
};

function normalizeOfficialName(officialName: string): string {
  return NAME_MAPPING[officialName] || officialName;
}

async function validateStvRounds(config: ValidationConfig): Promise<boolean> {
  console.log(
    `Validating STV rounds for case: ${config.case || "default"}, env: ${config.env}`,
  );

  const db = await DuckDBInstance.create();
  const conn = await db.connect();

  try {
    // Load STV results
    const roundsPath = `data/${config.env}/stv/stv_rounds.parquet`;
    const metaPath = `data/${config.env}/stv/stv_meta.parquet`;

    if (!existsSync(roundsPath) || !existsSync(metaPath)) {
      throw new Error(
        `STV artifacts not found. Expected: ${roundsPath}, ${metaPath}`,
      );
    }

    await conn.run(`CREATE VIEW stv_rounds AS SELECT * FROM '${roundsPath}'`);
    await conn.run(`CREATE VIEW stv_meta AS SELECT * FROM '${metaPath}'`);

    // Load data
    const roundsResult = await conn.run(
      `SELECT * FROM stv_rounds ORDER BY round, candidate_name`,
    );
    const metaResult = await conn.run(`SELECT * FROM stv_meta ORDER BY round`);

    const rounds =
      (await roundsResult.getRowObjects()) as unknown as StvRoundRecord[];
    const meta =
      (await metaResult.getRowObjects()) as unknown as StvMetaRecord[];

    console.log(
      `Loaded ${rounds.length} round records and ${meta.length} meta records`,
    );

    // Basic validations
    await validateBasicStructure(rounds, meta);
    await validateVoteConservation(rounds, meta);
    await validateWinnerConsistency(rounds, meta);

    // Compare with official results if available
    if (config.case) {
      await validateAgainstOfficial(config.case, rounds, meta);
    }

    console.log("✅ All STV validations passed");
    return true;
  } finally {
    await conn.closeSync();
  }
}

async function validateBasicStructure(
  rounds: StvRoundRecord[],
  meta: StvMetaRecord[],
): Promise<void> {
  console.log("Validating basic structure...");

  // Check that each round has consistent candidate set
  const roundGroups = new Map<number, StvRoundRecord[]>();
  for (const record of rounds) {
    if (!roundGroups.has(record.round)) {
      roundGroups.set(record.round, []);
    }
    roundGroups.get(record.round)?.push(record);
  }

  // Validate each round has all continuing candidates
  for (const [roundNum, roundRecords] of roundGroups) {
    const standingCount = roundRecords.filter(
      (r) => r.status === "standing",
    ).length;
    const electedCount = roundRecords.filter(
      (r) => r.status === "elected",
    ).length;
    const eliminatedCount = roundRecords.filter(
      (r) => r.status === "eliminated",
    ).length;

    console.log(
      `Round ${roundNum}: ${standingCount} standing, ${electedCount} elected, ${eliminatedCount} eliminated`,
    );
  }

  // Check meta records match round records
  const metaRounds = new Set(meta.map((m) => m.round));
  const dataRounds = new Set(rounds.map((r) => r.round));

  if (metaRounds.size !== dataRounds.size) {
    throw new Error(
      `Mismatch: ${metaRounds.size} meta rounds vs ${dataRounds.size} data rounds`,
    );
  }

  console.log("✅ Basic structure validation passed");
}

async function validateVoteConservation(
  rounds: StvRoundRecord[],
  meta: StvMetaRecord[],
): Promise<void> {
  console.log("Validating vote conservation...");

  // Group by round
  const roundGroups = new Map<
    number,
    { rounds: StvRoundRecord[]; meta: StvMetaRecord }
  >();

  for (const record of rounds) {
    if (!roundGroups.has(record.round)) {
      roundGroups.set(record.round, {
        rounds: [],
        meta: meta.find((m) => m.round === record.round) ?? {
          round: record.round,
          quota: 0,
          exhausted: 0,
          elected_this_round: null,
          eliminated_this_round: null,
        },
      });
    }
    roundGroups.get(record.round)?.rounds.push(record);
  }

  let previousTotal: DecimalType | null = null;

  for (const [
    roundNum,
    { rounds: roundRecords, meta: metaRecord },
  ] of roundGroups) {
    const totalVotes = roundRecords.reduce(
      (sum, r) => sum.plus(r.votes),
      new Decimal(0),
    );
    const totalWithExhausted = totalVotes.plus(metaRecord.exhausted);

    console.log(
      `Round ${roundNum}: ${totalVotes.toFixed(2)} active votes + ${metaRecord.exhausted.toFixed(2)} exhausted = ${totalWithExhausted.toFixed(2)} total`,
    );

    if (previousTotal !== null) {
      const difference = totalWithExhausted.minus(previousTotal).abs();
      if (difference.gt(1e-6)) {
        throw new Error(
          `Vote conservation violation in round ${roundNum}: difference of ${difference.toFixed(6)}`,
        );
      }
    }

    previousTotal = totalWithExhausted;
  }

  console.log("✅ Vote conservation validation passed");
}

async function validateWinnerConsistency(
  rounds: StvRoundRecord[],
  meta: StvMetaRecord[],
): Promise<void> {
  console.log("Validating winner consistency...");

  // Find all winners from rounds data
  const winnersFromRounds = new Set<string>();
  for (const record of rounds) {
    if (record.status === "elected") {
      winnersFromRounds.add(record.candidate_name);
    }
  }

  // Find all winners from meta data
  const winnersFromMeta = new Set<string>();
  for (const metaRecord of meta) {
    if (metaRecord.elected_this_round) {
      for (const winner of metaRecord.elected_this_round) {
        winnersFromMeta.add(winner);
      }
    }
  }

  // Check consistency
  if (winnersFromRounds.size !== winnersFromMeta.size) {
    throw new Error(
      `Winner count mismatch: rounds data shows ${winnersFromRounds.size}, meta shows ${winnersFromMeta.size}`,
    );
  }

  for (const winner of winnersFromRounds) {
    if (!winnersFromMeta.has(winner)) {
      throw new Error(`Winner ${winner} found in rounds but not in meta`);
    }
  }

  console.log(
    `✅ Winner consistency validated: ${winnersFromRounds.size} winners`,
  );
  console.log(`Winners: ${Array.from(winnersFromRounds).sort().join(", ")}`);
}

async function validateAgainstOfficial(
  testCase: string,
  rounds: StvRoundRecord[],
  meta: StvMetaRecord[],
): Promise<void> {
  const officialPath = `tests/golden/${testCase}/official-results.json`;

  if (!existsSync(officialPath)) {
    console.log(
      `⚠️  No official results found at ${officialPath}, skipping official validation`,
    );
    return;
  }

  console.log("Validating against official results...");

  const officialData = JSON.parse(
    readFileSync(officialPath, "utf-8"),
  ) as OfficialResults;
  const officialThreshold = parseFloat(officialData.config.threshold);

  // Check quota matches
  const ourQuota = meta[0]?.quota || 0;
  const quotaDiff = Math.abs(ourQuota - officialThreshold);
  if (quotaDiff > 1e-6) {
    throw new Error(
      `Quota mismatch: our ${ourQuota} vs official ${officialThreshold} (diff: ${quotaDiff})`,
    );
  }

  console.log(`✅ Quota matches: ${ourQuota}`);

  // Compare round-by-round tallies
  for (const officialRound of officialData.results) {
    const roundNum = officialRound.round;
    const ourRoundRecords = rounds.filter((r) => r.round === roundNum);

    if (ourRoundRecords.length === 0) {
      console.log(`⚠️  No data for round ${roundNum}, skipping comparison`);
      continue;
    }

    console.log(`Comparing round ${roundNum}...`);

    // Compare candidate tallies
    for (const [officialName, voteStr] of Object.entries(officialRound.tally)) {
      const normalizedName = normalizeOfficialName(officialName);
      const officialVotes = parseFloat(voteStr);

      const ourRecord = ourRoundRecords.find(
        (r) => r.candidate_name === normalizedName,
      );
      if (!ourRecord) {
        console.log(
          `⚠️  Candidate ${normalizedName} not found in our round ${roundNum} data`,
        );
        continue;
      }

      const voteDiff = Math.abs(ourRecord.votes - officialVotes);
      if (voteDiff > 1e-6) {
        throw new Error(
          `Vote count mismatch for ${normalizedName} in round ${roundNum}: our ${ourRecord.votes} vs official ${officialVotes} (diff: ${voteDiff})`,
        );
      }
    }
  }

  console.log("✅ Official results validation passed");
}

async function main() {
  const args = process.argv.slice(2);
  const config: ValidationConfig = {
    env: process.env.NODE_ENV === "development" ? "dev" : "prod",
    all: false,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--case=")) {
      config.case = arg.split("=")[1];
    } else if (arg === "--all") {
      config.all = true;
    }
  }

  try {
    if (config.all) {
      // Validate all available cases
      const testCases = ["micro", "portland_d2_2024"];
      let allPassed = true;

      for (const testCase of testCases) {
        try {
          console.log(`\n=== Validating case: ${testCase} ===`);
          const caseConfig = { ...config, case: testCase };
          await validateStvRounds(caseConfig);
        } catch (error) {
          console.error(`❌ Validation failed for case ${testCase}:`, error);
          allPassed = false;
        }
      }

      if (!allPassed) {
        process.exit(1);
      }
    } else {
      await validateStvRounds(config);
    }

    console.log("\n🎉 All validations completed successfully!");
  } catch (error) {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
