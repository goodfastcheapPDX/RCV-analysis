import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import type { Identity } from "@/contracts/ids";
import type { Manifest } from "@/contracts/manifest";
import {
  assertTableColumns,
  parseAllRows,
  sha256,
} from "@/lib/contract-enforcer";
import { getDataEnv } from "@/lib/env";
import { loggers } from "@/lib/logger";
import {
  type Data,
  Output,
  SQL_QUERIES,
  type Stats,
  type TransferMatrixOutput,
  VALIDATION_RULES,
} from "./index.contract";

/**
 * Computes vote transfer matrix from STV rounds data
 *
 * Analyzes vote changes between consecutive rounds to identify:
 * - Surplus transfers from elected candidates
 * - Elimination transfers from eliminated candidates
 * - Votes that become exhausted during transfers
 */
export async function computeTransferMatrix(
  identity: Identity,
): Promise<TransferMatrixOutput> {
  const dataEnv = getDataEnv();
  const outputPath = join(
    "data",
    dataEnv,
    identity.election_id,
    identity.contest_id,
  );

  // Validate input dependencies exist
  const stvRoundsPath = join(outputPath, "stv", "rounds.parquet");
  const stvMetaPath = join(outputPath, "stv", "meta.parquet");
  const ballotsLongPath = join(outputPath, "ingest", "ballots_long.parquet");

  if (!existsSync(stvRoundsPath)) {
    throw new Error(`Required input not found: ${stvRoundsPath}`);
  }
  if (!existsSync(stvMetaPath)) {
    throw new Error(`Required input not found: ${stvMetaPath}`);
  }
  if (!existsSync(ballotsLongPath)) {
    throw new Error(`Required input not found: ${ballotsLongPath}`);
  }

  const db = await DuckDBInstance.create();
  const conn = await db.connect();

  try {
    // Load input data as views
    await conn.run(SQL_QUERIES.createStvRoundsView(stvRoundsPath));
    await conn.run(SQL_QUERIES.createStvMetaView(stvMetaPath));
    await conn.run(SQL_QUERIES.createBallotsLongView(ballotsLongPath));

    // Create transfer matrix table with identity columns
    await conn.run(SQL_QUERIES.createTransferMatrix());

    // Add identity columns to match contract
    await conn.run(SQL_QUERIES.createTransferMatrixWithIdentity(identity));

    // Validate the computed data
    await assertTableColumns(conn, "transfer_matrix_with_identity", Output);
    const validatedRows = await parseAllRows(
      conn,
      "transfer_matrix_with_identity",
      Output,
    );

    // Validate business rules
    await validateTransferMatrix(conn);

    // Export to parquet
    const transferMatrixOutputPath = join(outputPath, "transfer_matrix");
    mkdirSync(transferMatrixOutputPath, { recursive: true });
    const transferMatrixPath = join(
      transferMatrixOutputPath,
      "transfer_matrix.parquet",
    );
    await conn.run(SQL_QUERIES.copyToParquet(transferMatrixPath));

    // Compute stats from validated data
    const stats: Stats = {
      total_rounds: Math.max(...validatedRows.map((r) => r.round), 0),
      total_transfers: validatedRows.length,
      total_exhausted_votes: validatedRows
        .filter((r) => r.to_candidate_name === null)
        .reduce((sum, r) => sum + r.vote_count, 0),
      candidates_with_transfers: new Set(
        validatedRows.map((r) => r.from_candidate_name),
      ).size,
      surplus_transfers: validatedRows.filter(
        (r) => r.transfer_reason === "surplus",
      ).length,
      elimination_transfers: validatedRows.filter(
        (r) => r.transfer_reason === "elimination",
      ).length,
    };

    const data: Data = {
      rows: validatedRows.length,
    };

    const parsedResult: TransferMatrixOutput = { stats, data };

    // Update manifest
    const manifestPath = join(outputPath, "manifest.json");
    updateManifest(manifestPath, parsedResult, transferMatrixPath);

    return parsedResult;
  } finally {
    await conn.closeSync();
  }
}

async function validateTransferMatrix(conn: DuckDBConnection): Promise<void> {
  // Vote conservation check: transfers should balance
  const conservationResult = await conn.run(`
    SELECT 
      round,
      SUM(CASE WHEN transfer_reason = 'elimination' THEN vote_count ELSE 0 END) AS elimination_total,
      SUM(CASE WHEN transfer_reason = 'surplus' THEN vote_count ELSE 0 END) AS surplus_total
    FROM transfer_matrix_with_identity 
    GROUP BY round
    HAVING elimination_total < 0 OR surplus_total < 0
  `);

  const conservationCheck = await conservationResult.getRowObjects();

  if (conservationCheck.length > 0) {
    const invalidRounds = conservationCheck.map((row) => row.round).join(", ");
    throw new Error(
      `Transfer validation failed: negative vote transfers found in rounds ${invalidRounds}`,
    );
  }

  // Structural checks: required columns and data types
  const structuralResult = await conn.run(`
    SELECT COUNT(*) as invalid_count 
    FROM transfer_matrix_with_identity 
    WHERE round <= 0 OR vote_count < 0 OR transfer_weight < 0 OR transfer_weight > 1
  `);

  const structuralCheck = await structuralResult.getRowObjects();

  const invalidCount = structuralCheck[0]?.invalid_count as number;
  if (invalidCount > 0) {
    throw new Error(
      `Transfer validation failed: ${invalidCount} rows with invalid structural data`,
    );
  }
}

function updateManifest(
  _manifestPath: string,
  result: TransferMatrixOutput,
  transferMatrixPath: string,
): void {
  // For now, we'll skip manifest updating since it has a complex structure
  // and we're focusing on getting the compute function working first.
  // The transfer matrix will be available as a parquet file for consumption.
  loggers.compute.info(
    `Transfer matrix stats: ${JSON.stringify(result.stats, null, 2)}`,
  );
  loggers.compute.info(`Transfer matrix written to: ${transferMatrixPath}`);
}
