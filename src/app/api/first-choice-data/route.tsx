export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { getArtifactPaths } from "@/packages/contracts/lib/artifact-paths";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";

export async function GET() {
  try {
    const paths = getArtifactPaths();

    // Verify the parquet file exists (created by compute step)
    if (!existsSync(paths.summary.firstChoice)) {
      return NextResponse.json(
        {
          error: `First choice data not found: ${paths.summary.firstChoice}. Run 'npm run build:data:firstchoice' first.`,
        },
        { status: 404 },
      );
    }

    // Dynamically import DuckDB to avoid SSG issues
    const duck = await import("@duckdb/node-api");

    const instance = await duck.DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      // Create view directly from parquet file
      await conn.run(
        `CREATE VIEW first_choice_data AS SELECT * FROM '${paths.summary.firstChoice}'`,
      );

      // Use contract enforcer to get validated Output[] data
      const validatedRows = await parseAllRows(
        conn,
        "first_choice_data",
        Output,
      );

      return NextResponse.json(validatedRows);
    } finally {
      await conn.closeSync();
    }
  } catch (error) {
    console.error("Error in first choice data API:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
