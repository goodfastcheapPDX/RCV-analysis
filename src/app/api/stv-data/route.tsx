export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { getArtifactPaths } from "@/packages/contracts/lib/artifact-paths";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import {
  StvMetaOutput,
  StvRoundsOutput,
  type StvRoundsStats,
} from "@/packages/contracts/slices/stv_rounds/index.contract";
import type { StvData } from "@/types/stv-data";

export async function GET() {
  try {
    const paths = getArtifactPaths();

    // Construct paths to STV artifacts
    const stvRoundsPath = paths.stv.rounds;
    const stvMetaPath = paths.stv.meta;

    // Verify the parquet files exist
    if (!existsSync(stvRoundsPath)) {
      return NextResponse.json(
        {
          error: `STV rounds data not found: ${stvRoundsPath}. Run 'npm run build:data:stv' first.`,
        },
        { status: 404 },
      );
    }

    if (!existsSync(stvMetaPath)) {
      return NextResponse.json(
        {
          error: `STV meta data not found: ${stvMetaPath}. Run 'npm run build:data:stv' first.`,
        },
        { status: 404 },
      );
    }

    // Dynamically import DuckDB to avoid SSG issues
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
        return NextResponse.json(
          { error: "No meta data found for first round" },
          { status: 500 },
        );
      }

      const stats: StvRoundsStats = {
        number_of_rounds: maxRound,
        winners,
        seats: winners.length, // Infer seats from number of winners
        first_round_quota: firstRoundMeta.quota,
        precision: 1e-6, // Default precision
      };

      const result: StvData = {
        roundsData,
        metaData,
        stats,
      };

      return NextResponse.json(result);
    } finally {
      await conn.closeSync();
    }
  } catch (error) {
    console.error("Error in STV data API:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
