import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import yaml from "js-yaml";
import { getArtifactPaths } from "../../lib/artifact-paths.js";
import {
  assertManifestSection,
  assertTableColumns,
  type DependencySpec,
  parseAllRows,
  sha256,
  validateDependencies,
} from "../../lib/contract-enforcer.js";
import { type BallotData, runSTV } from "./engine.js";
import {
  RulesSchema,
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
  version,
} from "./index.contract.js";

interface EnvironmentConfig {
  env: string;
  case?: string;
  seats: number;
}

/**
 * Main compute function for STV rounds analysis
 */
export async function computeStvRounds(): Promise<StvRoundsStats> {
  const config = getEnvironmentConfig();
  const paths = getArtifactPaths();

  // Validate dependencies before proceeding
  const dependencies: DependencySpec[] = [
    {
      key: `ingest_cvr@1.0.0`,
      minVersion: "1.0.0",
      buildCommand: "npm run build:data",
      artifacts: [
        {
          path: paths.ingest.ballotsLong,
          hashKey: "ballots_long_hash",
        },
        {
          path: paths.ingest.candidates,
          hashKey: "candidates_hash",
        },
      ],
    },
  ];

  console.log("Validating dependencies...");
  validateDependencies(paths.manifest, dependencies);
  console.log("✅ All dependencies validated");

  const db = await DuckDBInstance.create();
  const conn = await db.connect();

  try {
    // Load ballot data from parquet
    console.log(`Loading ballots from: ${paths.ingest.ballotsLong}`);

    await conn.run(`
      CREATE VIEW ballots_long AS 
      SELECT * FROM '${paths.ingest.ballotsLong}'
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

    // Load rules
    const rules = loadRules(config);
    console.log(`Using rules: ${JSON.stringify(rules, null, 2)}`);

    // Run STV algorithm
    console.log(`Running STV with ${ballotsData.length} ballot records...`);
    const stvResult = runSTV(ballotsData, rules);

    console.log(
      `STV completed: ${stvResult.rounds.length} round records, ${stvResult.winners.length} winners`,
    );

    // Validate all rows against contract schemas
    console.log("Validating output against contracts...");
    const validatedRounds = stvResult.rounds.map((row) =>
      StvRoundsOutput.parse(row),
    );
    const validatedMeta = stvResult.meta.map((row) => StvMetaOutput.parse(row));

    // Create output directory
    const outputDir = `data/${config.env}/stv`;
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Create temporary tables and export to parquet
    await conn.run(`DROP TABLE IF EXISTS tmp_stv_rounds`);
    await conn.run(`DROP TABLE IF EXISTS tmp_stv_meta`);

    // Create temp tables with proper schema
    await conn.run(`
      CREATE TABLE tmp_stv_rounds (
        round INTEGER,
        candidate_name VARCHAR,
        votes DOUBLE,
        status VARCHAR
      )
    `);

    await conn.run(`
      CREATE TABLE tmp_stv_meta (
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
        INSERT INTO tmp_stv_rounds VALUES (?, ?, ?, ?)
      `,
        [row.round, row.candidate_name, row.votes, row.status],
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
        INSERT INTO tmp_stv_meta VALUES (?, ?, ?, ${electedArray}, ${eliminatedArray})
      `,
        [row.round, row.quota, row.exhausted],
      );
    }

    // Assert table columns match contract
    await assertTableColumns(conn, "tmp_stv_rounds", StvRoundsOutput);
    await assertTableColumns(conn, "tmp_stv_meta", StvMetaOutput);

    // Parse all rows to ensure contract compliance
    await parseAllRows(conn, "tmp_stv_rounds", StvRoundsOutput);
    await parseAllRows(conn, "tmp_stv_meta", StvMetaOutput);

    // Export to parquet
    const roundsPath = `${outputDir}/stv_rounds.parquet`;
    const metaPath = `${outputDir}/stv_meta.parquet`;

    await conn.run(`COPY tmp_stv_rounds TO '${roundsPath}' (FORMAT 'parquet')`);
    await conn.run(`COPY tmp_stv_meta TO '${metaPath}' (FORMAT 'parquet')`);

    console.log(`Exported STV rounds to: ${roundsPath}`);
    console.log(`Exported STV meta to: ${metaPath}`);

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

    // Update manifest
    const manifestData = existsSync(paths.manifest)
      ? JSON.parse(readFileSync(paths.manifest, "utf-8"))
      : {};

    const manifestSection = {
      stats: validatedStats,
      stv_rounds_hash: sha256(roundsPath),
      stv_meta_hash: sha256(metaPath),
      version,
      created_at: new Date().toISOString(),
    };

    manifestData[`stv_rounds@${version}`] = manifestSection;

    // Write updated manifest
    mkdirSync(dirname(paths.manifest), { recursive: true });
    writeFileSync(paths.manifest, JSON.stringify(manifestData, null, 2));

    // Assert manifest section
    await assertManifestSection(
      paths.manifest,
      `stv_rounds@${version}`,
      StvRoundsStats,
    );

    console.log(`Updated manifest: ${paths.manifest}`);
    return validatedStats;
  } finally {
    await conn.closeSync();
  }
}

function getEnvironmentConfig(): EnvironmentConfig {
  const env = process.env.NODE_ENV === "development" ? "dev" : "prod";
  const testCase = process.env.CASE;
  const seats = process.env.SEATS ? parseInt(process.env.SEATS) : 3;

  return {
    env,
    case: testCase,
    seats,
  };
}

function loadRules(config: EnvironmentConfig): RulesSchema {
  let rules: Partial<RulesSchema> = {
    seats: config.seats,
    quota: "droop",
    surplus_method: "fractional",
    precision: 1e-6,
    tie_break: "lexicographic",
  };

  // Try to load rules from YAML file if case is specified
  if (config.case) {
    const rulesPath = `tests/golden/${config.case}/rules.yaml`;
    if (existsSync(rulesPath)) {
      console.log(`Loading rules from: ${rulesPath}`);
      const yamlContent = readFileSync(rulesPath, "utf-8");
      const yamlRules = yaml.load(yamlContent) as Partial<RulesSchema>;
      rules = { ...rules, ...yamlRules };
    } else {
      console.log(`Rules file not found: ${rulesPath}, using defaults`);
    }
  }

  // Validate and return rules
  return RulesSchema.parse(rules);
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  computeStvRounds()
    .then((stats) => {
      console.log("STV rounds computation completed successfully");
      console.log(
        `Results: ${stats.winners.length} winners in ${stats.number_of_rounds} rounds`,
      );
      console.log(`Winners: ${stats.winners.join(", ")}`);
    })
    .catch((error) => {
      console.error("STV rounds computation failed:", error);
      process.exit(1);
    });
}
