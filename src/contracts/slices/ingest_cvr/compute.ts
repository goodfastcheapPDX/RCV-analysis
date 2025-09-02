import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  type ContestId,
  createIdentity,
  type DistrictId,
  type ElectionId,
} from "@/contracts/ids";
import { ArtifactRef, type Manifest } from "@/contracts/manifest";
import {
  assertManifestSection,
  assertTableColumns,
  parseAllRows,
  preprocessDuckDBRow,
  sha256,
} from "@/lib/contract-enforcer";
import { type DataEnv, getDataEnv } from "@/lib/env";
import {
  BallotsLongOutput,
  CandidatesOutput,
  CONTRACT_VERSION,
  type IngestCvrOutput,
  IngestCvrOutputSchema,
  SQL_QUERIES,
} from "./index.contract";

interface IngestCvrOptions {
  electionId: ElectionId;
  contestId: ContestId;
  districtId: DistrictId;
  seatCount: number;
  srcCsv: string;
}

function getOutputPath(
  env: string,
  electionId: ElectionId,
  contestId: ContestId,
): string {
  return `data/${env}/${electionId}/${contestId}/ingest`;
}

function getManifestPath(env: string): string {
  return `data/${env}/manifest.json`;
}

export async function ingestCvr(
  options?: IngestCvrOptions,
): Promise<IngestCvrOutput> {
  // Support both new parameterized call and legacy environment-based call
  const electionId =
    options?.electionId || ("portland-20241105-gen" as ElectionId);
  const contestId = options?.contestId || ("d2-3seat" as ContestId);
  const districtId = options?.districtId || ("d2" as DistrictId);
  const seatCount = options?.seatCount || 3;
  const srcCsv = options?.srcCsv || process.env.SRC_CSV;

  if (!srcCsv) {
    throw new Error(
      "SRC_CSV must be provided via options or environment variable",
    );
  }

  const env = getDataEnv();
  const outputPath = getOutputPath(env, electionId, contestId);
  const manifestPath = getManifestPath(env);
  const dbPath = "data/working/election.duckdb";

  // Create identity for this contest
  const identity = createIdentity(electionId, contestId, districtId, seatCount);

  console.log(`Processing CVR for ${electionId}/${contestId}`);
  console.log(`Source CSV: ${srcCsv}`);
  console.log(`Output path: ${outputPath}`);

  // Ensure directories exist
  mkdirSync(outputPath, { recursive: true });
  mkdirSync(dirname(dbPath), { recursive: true });

  // Create database instance
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run("BEGIN TRANSACTION");

    // Step 1: Load raw CSV data
    console.log("Loading raw CSV data...");
    await conn.run(SQL_QUERIES.createRawTable(srcCsv));

    // Step 2: Create candidates table
    console.log("Creating candidates table...");
    await conn.run(SQL_QUERIES.createCandidatesTable);

    // Step 3: Create candidate columns mapping table
    console.log("Creating candidate columns mapping...");
    await conn.run(SQL_QUERIES.createCandidateColumnsTable);

    // Step 4: Generate UNION ALL query for ballots_long
    console.log("Generating ballots_long normalization query...");
    const candidateColumnsResult = await conn.run(
      "SELECT column_name FROM candidate_columns",
    );
    const candidateColumns = await candidateColumnsResult.getRowObjects();

    if (!candidateColumns || candidateColumns.length === 0) {
      throw new Error("No candidate columns found. Check CSV header format.");
    }

    const unionQueries = candidateColumns.map((row) => {
      const columnName = row.column_name as string;
      // Escape single quotes in column name for SQL string literal
      const escapedColumnName = columnName.replace(/'/g, "''");
      return `SELECT BallotID, PrecinctID, BallotStyleID, '${escapedColumnName}' AS column_name, CAST("${columnName}" AS INTEGER) AS has_vote FROM rcv_raw WHERE Status=0 AND "${columnName}"=1`;
    });

    const unionAllQuery = unionQueries.join(" UNION ALL ");
    const finalBallotsLongQuery = SQL_QUERIES.createBallotsLongTable.replace(
      "__UNION_ALL_PLACEHOLDER__",
      unionAllQuery,
    );

    // Step 5: Create ballots_long table
    console.log("Creating ballots_long table...");
    await conn.run(finalBallotsLongQuery);

    // Step 6: Add identity columns to output tables
    console.log("Adding identity columns...");

    // Create candidates with identity
    await conn.run(`
      CREATE OR REPLACE TABLE candidates_with_identity AS
      SELECT
        '${identity.election_id}' AS election_id,
        '${identity.contest_id}' AS contest_id,
        '${identity.district_id}' AS district_id,
        ${identity.seat_count} AS seat_count,
        candidate_id,
        candidate_name
      FROM candidates;
    `);

    // Create ballots_long with identity
    await conn.run(`
      CREATE OR REPLACE TABLE ballots_long_with_identity AS
      SELECT
        '${identity.election_id}' AS election_id,
        '${identity.contest_id}' AS contest_id,
        '${identity.district_id}' AS district_id,
        ${identity.seat_count} AS seat_count,
        BallotID,
        PrecinctID,
        BallotStyleID,
        candidate_id,
        candidate_name,
        rank_position,
        has_vote
      FROM ballots_long;
    `);

    // Step 7: Validate schemas before export
    console.log("Validating schemas...");
    await assertTableColumns(
      conn,
      "candidates_with_identity",
      CandidatesOutput,
    );
    await assertTableColumns(
      conn,
      "ballots_long_with_identity",
      BallotsLongOutput,
    );

    // For large datasets, validate a sample and calculate stats via SQL
    console.log("Validating sample data...");
    const sampleSize = 1000;

    // Validate a sample of candidates data
    const candidatesSample = await conn.run(
      `SELECT * FROM candidates_with_identity LIMIT ${sampleSize}`,
    );
    const candidatesSampleRows = await candidatesSample.getRowObjects();
    candidatesSampleRows.forEach((row, index) => {
      try {
        const processedRow = preprocessDuckDBRow(row);
        CandidatesOutput.parse(processedRow);
      } catch (error) {
        throw new Error(
          `Candidates row ${index} failed validation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    // Validate a sample of ballots data
    const ballotsSample = await conn.run(
      `SELECT * FROM ballots_long_with_identity LIMIT ${sampleSize}`,
    );
    const ballotsSampleRows = await ballotsSample.getRowObjects();
    ballotsSampleRows.forEach((row, index) => {
      try {
        const processedRow = preprocessDuckDBRow(row);
        BallotsLongOutput.parse(processedRow);
      } catch (error) {
        throw new Error(
          `Ballots row ${index} failed validation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    // Step 8: Export to Parquet files
    console.log(`Exporting candidates to ${outputPath}/candidates.parquet...`);
    await conn.run(SQL_QUERIES.exportCandidates(outputPath));

    console.log(
      `Exporting ballots_long to ${outputPath}/ballots_long.parquet...`,
    );
    await conn.run(SQL_QUERIES.exportBallotsLong(outputPath));

    await conn.run("COMMIT");

    // Step 9: Calculate stats via SQL (efficient for large datasets)
    console.log("Calculating stats via SQL...");
    const statsQuery = `
      WITH ballots_stats AS (
        SELECT
          COUNT(*) AS rows,
          COUNT(DISTINCT BallotID) AS ballots,
          COUNT(DISTINCT candidate_id) AS candidates,
          MIN(rank_position) AS min_rank,
          MAX(rank_position) AS max_rank
        FROM ballots_long_with_identity
      ),
      candidates_stats AS (
        SELECT COUNT(*) AS rows FROM candidates_with_identity
      )
      SELECT 
        candidates_stats.rows AS candidate_rows,
        ballots_stats.rows AS ballot_rows,
        ballots_stats.ballots,
        ballots_stats.candidates,
        ballots_stats.min_rank,
        ballots_stats.max_rank
      FROM ballots_stats, candidates_stats;
    `;

    const statsResult = await conn.run(statsQuery);
    const statsData = await statsResult.getRowObjects();
    const rawStats = statsData[0];

    const stats = {
      candidates: {
        rows: Number(rawStats.candidate_rows),
      },
      ballots_long: {
        rows: Number(rawStats.ballot_rows),
        ballots: Number(rawStats.ballots),
        candidates: Number(rawStats.candidates),
        min_rank: Number(rawStats.min_rank),
        max_rank: Number(rawStats.max_rank),
        duplicate_ballots: 0, // TODO: Calculate from ballot ID counts
      },
    };

    // Step 10: Update manifest
    console.log("Updating manifest...");

    const candidatesPath = `${outputPath}/candidates.parquet`;
    const ballotsLongPath = `${outputPath}/ballots_long.parquet`;

    // Calculate file hashes
    const candidatesHash = sha256(candidatesPath);
    const ballotsLongHash = sha256(ballotsLongPath);

    // Load or create manifest
    let manifest: Manifest;
    if (existsSync(manifestPath)) {
      try {
        const manifestData = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest = manifestData as Manifest; // TODO: Add validation
      } catch (error) {
        console.warn(
          "Could not parse existing manifest, creating new one:",
          error,
        );
        manifest = {
          env: env as DataEnv,
          version: 2,
          inputs: {},
          elections: [],
        };
      }
    } else {
      manifest = {
        env: env as DataEnv,
        version: 2,
        inputs: {},
        elections: [],
      };
    }

    // Find or create election
    let election = manifest.elections.find((e) => e.election_id === electionId);
    if (!election) {
      election = {
        election_id: electionId,
        date: "2024-11-05", // TODO: Extract from electionId
        jurisdiction: "portland", // TODO: Extract from electionId
        title: "Portland General Election 2024",
        contests: [],
      };
      manifest.elections.push(election);
    }

    // Find or create contest
    let contest = election.contests.find((c) => c.contest_id === contestId);
    if (!contest) {
      contest = {
        contest_id: contestId,
        district_id: districtId,
        seat_count: seatCount,
        title: `City Council District ${districtId.slice(1)} (${seatCount} seats)`,
        cvr: {
          candidates: {
            uri: candidatesPath,
            sha256: candidatesHash,
            rows: stats.candidates.rows,
          },
          ballots_long: {
            uri: ballotsLongPath,
            sha256: ballotsLongHash,
            rows: stats.ballots_long.rows,
          },
        },
        stv: {},
        rules: {
          method: "meek",
          quota: "droop",
          precision: 1e-6,
          tie_break: "lexicographic",
          seats: seatCount,
        },
      };
      election.contests.push(contest);
    } else {
      // Update existing contest CVR data
      contest.cvr.candidates = {
        uri: candidatesPath,
        sha256: candidatesHash,
        rows: stats.candidates.rows,
      };
      contest.cvr.ballots_long = {
        uri: ballotsLongPath,
        sha256: ballotsLongHash,
        rows: stats.ballots_long.rows,
      };
    }

    // Update manifest input hashes
    manifest.inputs[`${electionId}/${contestId}`] = {
      cvr_files: [
        {
          path: srcCsv,
          sha256: sha256(srcCsv),
        },
      ],
    };

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log("✅ CVR ingestion completed successfully!");
    console.log(`📊 Statistics:`);
    console.log(`  - Candidates: ${stats.candidates.rows}`);
    console.log(`  - Ballots: ${stats.ballots_long.ballots}`);
    console.log(`  - Total vote records: ${stats.ballots_long.rows}`);
    console.log(
      `  - Rank range: ${stats.ballots_long.min_rank}-${stats.ballots_long.max_rank}`,
    );

    return IngestCvrOutputSchema.parse(stats);
  } catch (error) {
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
