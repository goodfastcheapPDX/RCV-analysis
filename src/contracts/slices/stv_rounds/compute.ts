import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import yaml from "js-yaml";
import {
  type ContestId,
  createIdentity,
  type DistrictId,
  type ElectionId,
} from "@/contracts/ids";
import type { Manifest } from "@/contracts/manifest";
import {
  assertTableColumns,
  parseAllRows,
  sha256,
} from "@/lib/contract-enforcer";
import { getDataEnv } from "@/lib/env";
import { createTimer, logError, loggers } from "@/lib/logger";
import { type BallotData, runSTV } from "./engine";
import {
  RulesSchema,
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "./index.contract";

interface ComputeStvOptions {
  electionId: ElectionId;
  contestId: ContestId;
  districtId: DistrictId;
  seatCount: number;
}

function getOutputPath(
  env: string,
  electionId: ElectionId,
  contestId: ContestId,
): string {
  return `data/${env}/${electionId}/${contestId}/stv`;
}

function getManifestPath(env: string): string {
  return `data/${env}/manifest.json`;
}

/**
 * Main compute function for STV rounds analysis
 */
export async function computeStvRounds(
  options?: ComputeStvOptions,
): Promise<StvRoundsStats> {
  // Support both new parameterized call and legacy environment-based call
  const electionId =
    options?.electionId || ("portland-20241105-gen" as ElectionId);
  const contestId = options?.contestId || ("d2-3seat" as ContestId);
  const districtId = options?.districtId || ("d2" as DistrictId);
  const seatCount = options?.seatCount || 3;

  const env = getDataEnv();
  const outputPath = getOutputPath(env, electionId, contestId);
  const manifestPath = getManifestPath(env);

  // Create identity for this contest
  const identity = createIdentity(electionId, contestId, districtId, seatCount);

  const timer = createTimer(
    loggers.compute,
    `STV computation for ${electionId}/${contestId}`,
  );

  loggers.compute.info("Starting STV computation", {
    electionId,
    contestId,
    districtId,
    seatCount,
    outputPath,
  });

  // Ensure directories exist
  mkdirSync(outputPath, { recursive: true });

  // Load manifest to get ballots data path
  let manifest: Manifest;
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Manifest not found: ${manifestPath}. Run CVR ingestion first.`,
    );
  }

  const manifestData = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest = manifestData as Manifest;

  // Find the contest in manifest
  const election = manifest.elections.find((e) => e.election_id === electionId);
  if (!election) {
    throw new Error(`Election ${electionId} not found in manifest`);
  }

  const contest = election.contests.find((c) => c.contest_id === contestId);
  if (!contest) {
    throw new Error(`Contest ${contestId} not found in manifest`);
  }

  if (!contest.cvr.ballots_long) {
    throw new Error(
      `Ballots data not found for contest ${electionId}/${contestId}`,
    );
  }

  const ballotsPath = contest.cvr.ballots_long.uri;
  loggers.compute.info(`Loading ballots from: ${ballotsPath}`);

  const db = await DuckDBInstance.create();
  const conn = await db.connect();

  try {
    await conn.run("BEGIN TRANSACTION");

    // Load ballot data from parquet
    await conn.run(`
      CREATE VIEW ballots_long AS 
      SELECT * FROM '${ballotsPath}'
    `);

    // Load ballot data for STV engine
    const ballotsResult = await conn.run(`
      SELECT BallotID, candidate_name, rank_position 
      FROM ballots_long 
      WHERE has_vote = true
      ORDER BY BallotID, rank_position
    `);
    const ballotsData =
      (await ballotsResult.getRowObjects()) as unknown as BallotData[];

    // Load rules from contest manifest
    const rules = {
      seats: seatCount,
      quota: "droop" as const,
      surplus_method: "fractional" as const,
      precision: 0.000001,
      tie_break: "lexicographic" as const,
    };
    loggers.compute.debug(`Using rules: ${JSON.stringify(rules, null, 2)}`);

    // Run STV algorithm
    loggers.compute.info(
      `Running STV with ${ballotsData.length} ballot records...`,
    );
    const stvResult = runSTV(ballotsData, rules, identity);

    loggers.compute.info(
      `STV completed: ${stvResult.rounds.length} round records, ${stvResult.winners.length} winners`,
    );

    // Validate all rows against contract schemas
    loggers.compute.info("Validating output against contracts...");
    const validatedRounds = stvResult.rounds.map((row) =>
      StvRoundsOutput.parse(row),
    );
    const validatedMeta = stvResult.meta.map((row) => StvMetaOutput.parse(row));

    // Create temporary tables and export to parquet
    await conn.run(`DROP TABLE IF EXISTS tmp_stv_rounds`);
    await conn.run(`DROP TABLE IF EXISTS tmp_stv_meta`);

    // Create temp tables with proper schema including identity columns
    await conn.run(`
      CREATE TABLE tmp_stv_rounds (
        election_id VARCHAR,
        contest_id VARCHAR,
        district_id VARCHAR,
        seat_count INTEGER,
        round INTEGER,
        candidate_name VARCHAR,
        votes DOUBLE,
        status VARCHAR
      )
    `);

    await conn.run(`
      CREATE TABLE tmp_stv_meta (
        election_id VARCHAR,
        contest_id VARCHAR,
        district_id VARCHAR,
        seat_count INTEGER,
        round INTEGER,
        quota DOUBLE,
        exhausted DOUBLE,
        elected_this_round VARCHAR[],
        eliminated_this_round VARCHAR[]
      )
    `);

    // Insert validated data
    for (const row of validatedRounds) {
      await conn.run(
        `
        INSERT INTO tmp_stv_rounds VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          row.election_id,
          row.contest_id,
          row.district_id,
          row.seat_count,
          row.round,
          row.candidate_name,
          row.votes,
          row.status,
        ],
      );
    }

    for (const row of validatedMeta) {
      const electedArray = row.elected_this_round
        ? `ARRAY[${row.elected_this_round.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")}]`
        : "NULL";
      const eliminatedArray = row.eliminated_this_round
        ? `ARRAY[${row.eliminated_this_round.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")}]`
        : "NULL";

      await conn.run(
        `
        INSERT INTO tmp_stv_meta VALUES (?, ?, ?, ?, ?, ?, ?, ${electedArray}, ${eliminatedArray})
      `,
        [
          row.election_id,
          row.contest_id,
          row.district_id,
          row.seat_count,
          row.round,
          row.quota,
          row.exhausted,
        ],
      );
    }

    // Assert table columns match contract
    await assertTableColumns(conn, "tmp_stv_rounds", StvRoundsOutput);
    await assertTableColumns(conn, "tmp_stv_meta", StvMetaOutput);

    // Parse all rows to ensure contract compliance
    await parseAllRows(conn, "tmp_stv_rounds", StvRoundsOutput);
    await parseAllRows(conn, "tmp_stv_meta", StvMetaOutput);

    // Export to parquet
    const roundsPath = `${outputPath}/rounds.parquet`;
    const metaPath = `${outputPath}/meta.parquet`;

    await conn.run(`COPY tmp_stv_rounds TO '${roundsPath}' (FORMAT 'parquet')`);
    await conn.run(`COPY tmp_stv_meta TO '${metaPath}' (FORMAT 'parquet')`);

    loggers.compute.info(`Exported STV rounds to: ${roundsPath}`);
    loggers.compute.info(`Exported STV meta to: ${metaPath}`);

    // Calculate stats for manifest
    const stats: StvRoundsStats = {
      number_of_rounds: stvResult.meta.length,
      winners: stvResult.winners,
      seats: rules.seats,
      first_round_quota: stvResult.meta[0]?.quota || 0,
      precision: rules.precision,
    };

    // Validate stats with contract
    const validatedStats = StvRoundsStats.parse(stats);

    await conn.run("COMMIT");

    // Calculate file hashes
    const roundsHash = sha256(roundsPath);
    const metaHash = sha256(metaPath);

    // Update manifest with STV data
    loggers.compute.info("Updating manifest...");

    // Update the contest with STV results
    contest.stv = {
      rounds: {
        uri: roundsPath,
        sha256: roundsHash,
        rows: validatedRounds.length,
      },
      meta: {
        uri: metaPath,
        sha256: metaHash,
        rows: validatedMeta.length,
      },
      stats: validatedStats,
    };

    // Update manifest

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    timer.end({
      rounds: validatedStats.number_of_rounds,
      winners: validatedStats.winners,
      seats: validatedStats.seats,
      firstRoundQuota: validatedStats.first_round_quota,
    });

    loggers.compute.info("✅ STV computation completed successfully!");
    loggers.compute.info("📊 Statistics", {
      rounds: validatedStats.number_of_rounds,
      winners: validatedStats.winners.join(", "),
      seats: validatedStats.seats,
      firstRoundQuota: validatedStats.first_round_quota.toFixed(2),
    });
    return validatedStats;
  } catch (error) {
    logError(loggers.compute, error, {
      operation: "STV computation",
      electionId,
      contestId,
    });
    try {
      await conn.run("ROLLBACK");
    } catch {
      // Ignore rollback errors
    }
    throw error;
  } finally {
    await conn.closeSync();
  }
}

// Legacy function for backward compatibility
function _loadRulesFromYaml(testCase?: string): RulesSchema {
  let rules: Partial<RulesSchema> = {
    seats: 3,
    quota: "droop",
    surplus_method: "fractional",
    precision: 1e-6,
    tie_break: "lexicographic",
  };

  // Try to load rules from YAML file if case is specified
  if (testCase) {
    const rulesPath = `tests/golden/${testCase}/rules.yaml`;
    if (existsSync(rulesPath)) {
      loggers.compute.info(`Loading rules from: ${rulesPath}`);
      const yamlContent = readFileSync(rulesPath, "utf-8");
      const yamlRules = yaml.load(yamlContent) as Partial<RulesSchema>;
      rules = { ...rules, ...yamlRules };
    } else {
      loggers.compute.warn(
        `Rules file not found: ${rulesPath}, using defaults`,
      );
    }
  }

  // Validate and return rules
  return RulesSchema.parse(rules);
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  computeStvRounds()
    .then((stats) => {
      loggers.compute.info("STV rounds computation completed successfully");
      loggers.compute.info(
        `Results: ${stats.winners.length} winners in ${stats.number_of_rounds} rounds`,
      );
      loggers.compute.info(`Winners: ${stats.winners.join(", ")}`);
    })
    .catch((error) => {
      logError(loggers.compute, error, {
        context: "STV rounds computation failed",
      });
      process.exit(1);
    });
}
