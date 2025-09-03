import { Output as TransferMatrixOutput } from "@/contracts/slices/transfer_matrix/index.contract";
import { parseAllRows } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolverSync,
} from "./contest-resolver";

/**
 * Load transfer matrix data for a specific contest
 * Uses existing contract validation from transfer_matrix slice
 */
export async function loadTransferMatrixForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || createContestResolverSync(env);

  const uri = contestResolver.getTransferMatrixUri(electionId, contestId);
  if (!uri) {
    throw new Error(
      `Transfer matrix data not available for contest ${electionId}/${contestId}`,
    );
  }

  // Dynamically import DuckDB to avoid SSG issues
  const duck = await import("@duckdb/node-api");
  const instance = await duck.DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Create view directly from parquet file
    await conn.run(
      `CREATE VIEW transfer_matrix_data AS SELECT * FROM '${uri}'`,
    );

    // Use contract enforcer to get validated data
    const data = await parseAllRows(
      conn,
      "transfer_matrix_data",
      TransferMatrixOutput,
    );

    const contest = contestResolver.getContest(electionId, contestId);
    const election = contestResolver.getElection(electionId);

    return {
      data,
      contest,
      election,
    };
  } finally {
    await conn.closeSync();
  }
}
