import { existsSync } from "node:fs";
import { getContestArtifacts, loadManifestSync } from "@/lib/manifest";
import { parseAllRows } from "@/packages/contracts/lib/contract-enforcer";
import { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";

export interface FirstChoiceDataParams {
  electionId?: string;
  contestId?: string;
}

export async function handleFirstChoiceDataRequest(
  params: FirstChoiceDataParams = {},
) {
  try {
    // Get election and contest from params, with defaults
    const electionId = params.electionId || "portland-20241105-gen";
    const contestId = params.contestId || "d2-3seat";

    // Load manifest and find contest data
    const manifest = loadManifestSync();
    const artifacts = getContestArtifacts(manifest, electionId, contestId);

    // Verify the first choice parquet file exists
    if (!artifacts.firstChoice || !existsSync(artifacts.firstChoice)) {
      return {
        success: false,
        error: `First choice data not found for ${electionId}/${contestId}. Expected: ${artifacts.firstChoice || "not generated"}. Run first choice breakdown first.`,
        status: 404,
      };
    }

    // Dynamically import DuckDB to avoid SSG issues
    const duck = await import("@duckdb/node-api");

    const instance = await duck.DuckDBInstance.create();
    const conn = await instance.connect();

    try {
      // Create view directly from parquet file
      await conn.run(
        `CREATE VIEW first_choice_data AS SELECT * FROM '${artifacts.firstChoice}'`,
      );

      // Use contract enforcer to get validated Output[] data
      const validatedRows = await parseAllRows(
        conn,
        "first_choice_data",
        Output,
      );

      return {
        success: true,
        data: {
          electionId,
          contestId,
          data: validatedRows,
          metadata: {
            contest: artifacts.contest,
            artifactUri: artifacts.firstChoice,
          },
        },
      };
    } finally {
      await conn.closeSync();
    }
  } catch (error) {
    console.error("Error in first choice data handler:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      status: 500,
    };
  }
}
