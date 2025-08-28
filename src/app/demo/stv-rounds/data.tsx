"use server";

import { existsSync } from "node:fs";
import { getArtifactPaths } from "@/packages/contracts/lib/artifact-paths";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import {
  StvMetaOutput,
  StvRoundsOutput,
  type StvRoundsStats,
} from "@/packages/contracts/slices/stv_rounds/index.contract";

export interface StvData {
  roundsData: StvRoundsOutput[];
  metaData: StvMetaOutput[];
  stats: StvRoundsStats;
}

export async function getStvData(): Promise<StvData> {
  const paths = getArtifactPaths();

  // Construct paths to STV artifacts
  const stvRoundsPath = paths.stv.rounds;
  const stvMetaPath = paths.stv.meta;
  // Verify the parquet files exist
  if (!existsSync(stvRoundsPath)) {
    throw new Error(
      `STV rounds data not found: ${stvRoundsPath}. Run 'npm run build:data:stv' first.`,
    );
  }

  if (!existsSync(stvMetaPath)) {
    throw new Error(
      `STV meta data not found: ${stvMetaPath}. Run 'npm run build:data:stv' first.`,
    );
  }
  const duck = await import("@duckdb/node-api");

  const instance = await duck.DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create views from parquet files
    await conn.run(
      `CREATE VIEW stv_rounds_data AS SELECT * FROM '${stvRoundsPath}' ORDER BY round, candidate_name`,
    );

    await conn.run(
      `CREATE VIEW stv_meta_data AS SELECT * FROM '${stvMetaPath}' ORDER BY round`,
    );

    // Use contract enforcer to get validated data
    const roundsData = await parseAllRows(
      conn,
      "stv_rounds_data",
      StvRoundsOutput,
    );
    const metaData = await parseAllRows(conn, "stv_meta_data", StvMetaOutput);

    // Calculate stats from the data
    const maxRound = Math.max(...roundsData.map((r) => r.round));
    const winners = [
      ...new Set(
        roundsData
          .filter((r) => r.status === "elected")
          .map((r) => r.candidate_name),
      ),
    ];

    const firstRoundMeta = metaData.find((m) => m.round === 1);
    if (!firstRoundMeta) {
      throw new Error("No meta data found for first round");
    }

    const stats: StvRoundsStats = {
      number_of_rounds: maxRound,
      winners,
      seats: winners.length, // Infer seats from number of winners
      first_round_quota: firstRoundMeta.quota,
      precision: 1e-6, // Default precision
    };

    return {
      roundsData,
      metaData,
      stats,
    };
  } finally {
    await conn.closeSync();
  }
}
