"use server";
import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { getArtifactPaths } from "@/packages/contracts/lib/artifact-paths";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";

export async function getFirstChoiceData(): Promise<Output[]> {
  const paths = getArtifactPaths();

  // Verify the parquet file exists (created by compute step)
  if (!existsSync(paths.summary.firstChoice)) {
    throw new Error(
      `First choice data not found: ${paths.summary.firstChoice}. Run first_choice_breakdown compute step first.`,
    );
  }

  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create view directly from parquet file
    await conn.run(
      `CREATE VIEW first_choice_data AS SELECT * FROM '${paths.summary.firstChoice}'`,
    );

    // Use contract enforcer to get validated Output[] data
    const validatedRows = await parseAllRows(conn, "first_choice_data", Output);

    return validatedRows;
  } finally {
    await conn.closeSync();
  }
}
