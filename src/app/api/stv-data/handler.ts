import { existsSync } from "node:fs";
import { getContestArtifacts, loadManifestSync } from "@/lib/manifest";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import {
  StvMetaOutput,
  StvRoundsOutput,
} from "@/packages/contracts/slices/stv_rounds/index.contract";

export interface StvDataParams {
  electionId?: string;
  contestId?: string;
}

export async function handleStvDataRequest(params: StvDataParams = {}) {
  try {
    // Get election and contest from params, with defaults
    const electionId = params.electionId || "portland-20241105-gen";
    const contestId = params.contestId || "d2-3seat";

    // Load manifest and find contest data
    const manifest = loadManifestSync();
    const artifacts = getContestArtifacts(manifest, electionId, contestId);

    // Verify both STV rounds and meta parquet files exist
    if (!artifacts.stvRounds || !existsSync(artifacts.stvRounds)) {
      return {
        success: false,
        error: `STV rounds data not found for ${electionId}/${contestId}. Expected: ${artifacts.stvRounds || "not generated"}. Run STV rounds computation first.`,
        status: 404,
      };
    }

    if (!artifacts.stvMeta || !existsSync(artifacts.stvMeta)) {
      return {
        success: false,
        error: `STV meta data not found for ${electionId}/${contestId}. Expected: ${artifacts.stvMeta || "not generated"}. Run STV rounds computation first.`,
        status: 404,
      };
    }

    // Dynamically import DuckDB to avoid SSG issues
    const duck = await import("@duckdb/node-api");

    const instance = await duck.DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      // Create views from both parquet files
      await conn.run(
        `CREATE VIEW stv_rounds_data AS SELECT * FROM '${artifacts.stvRounds}'`,
      );

      await conn.run(
        `CREATE VIEW stv_meta_data AS SELECT * FROM '${artifacts.stvMeta}'`,
      );

      // Get rounds data from rounds parquet file
      const roundsData = await parseAllRows(
        conn,
        "stv_rounds_data",
        StvRoundsOutput,
      );

      // Get meta data from meta parquet file
      const metaData = await parseAllRows(conn, "stv_meta_data", StvMetaOutput);

      // Get stats from manifest
      const contestStats = artifacts.contest.stv.stats;

      return {
        success: true,
        data: {
          electionId,
          contestId,
          roundsData,
          metaData,
          stats: contestStats || null,
          metadata: {
            contest: artifacts.contest,
            roundsUri: artifacts.stvRounds,
            metaUri: artifacts.stvMeta,
          },
        },
      };
    } finally {
      await conn.closeSync();
    }
  } catch (error) {
    console.error("Error in STV data handler:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      status: 500,
    };
  }
}
