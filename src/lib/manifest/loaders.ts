import { Output as FirstChoiceOutput } from "@/contracts/slices/first_choice_breakdown/index.contract";
import { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import { Output as RankDistributionOutput } from "@/contracts/slices/rank_distribution_by_candidate/index.contract";
import {
  StvMetaOutput,
  StvRoundsOutput,
  type StvRoundsStats,
} from "@/contracts/slices/stv_rounds/index.contract";
import { parseAllRowsFromParquet } from "@/lib/contract-enforcer";
import {
  type ContestResolver,
  createContestResolver,
} from "./contest-resolver";

/**
 * Load first-choice data for a specific contest
 * Uses existing contract validation from first_choice slice
 */
export async function loadFirstChoiceForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const contest = contestResolver.getContest(electionId, contestId);
  if (!contest.first_choice) {
    throw new Error(
      `First-choice data not available for contest ${electionId}/${contestId}`,
    );
  }

  const uri = contestResolver.resolveArtifactUrl(contest.first_choice);

  // Use hyparquet to read parquet file directly with contract validation
  const data = await parseAllRowsFromParquet(uri, FirstChoiceOutput);

  const contestData = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest: contestData,
    election,
  };
}

/**
 * Load STV rounds data for a specific contest
 * Uses existing contract validation from stv_rounds slice
 */
export async function loadStvForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const contest = contestResolver.getContest(electionId, contestId);
  if (!contest.stv.rounds) {
    throw new Error(
      `STV data not available for contest ${electionId}/${contestId}`,
    );
  }

  const roundsUri = contestResolver.resolveArtifactUrl(contest.stv.rounds);
  const metaUri = contest.stv.meta
    ? contestResolver.resolveArtifactUrl(contest.stv.meta)
    : null;

  const election = contestResolver.getElection(electionId);

  // Use hyparquet to read parquet files directly with contract validation
  const roundsData = await parseAllRowsFromParquet(roundsUri, StvRoundsOutput);
  const metaData = metaUri
    ? await parseAllRowsFromParquet(metaUri, StvMetaOutput)
    : [];

  // Calculate basic stats from rounds data
  const stats: StvRoundsStats = {
    number_of_rounds: Math.max(...roundsData.map((r) => r.round)),
    winners: [
      ...new Set(
        roundsData
          .filter((r) => r.status === "elected")
          .map((r) => r.candidate_name),
      ),
    ],
    seats: contest.seat_count,
    first_round_quota: metaData.find((m) => m.round === 1)?.quota || 0,
    precision: 0.000001,
  };

  return {
    roundsData,
    metaData,
    stats,
    contest,
    election,
  };
}

/**
 * Load candidates data for a specific contest
 * Uses existing contract validation from ingest_cvr slice
 */
export async function loadCandidatesForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const contest = contestResolver.getContest(electionId, contestId);
  if (!contest.cvr.candidates) {
    throw new Error(
      `Candidates data not available for contest ${electionId}/${contestId}`,
    );
  }

  const uri = contestResolver.resolveArtifactUrl(contest.cvr.candidates);

  // Use hyparquet to read parquet file directly with contract validation
  const data = await parseAllRowsFromParquet(uri, CandidatesOutput);

  const contestData = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest: contestData,
    election,
  };
}

/**
 * Load rank distribution data for a specific contest
 * Uses existing contract validation from rank_distribution_by_candidate slice
 */
export async function loadRankDistributionForContest(
  electionId: string,
  contestId: string,
  env?: string,
  resolver?: ContestResolver,
) {
  const contestResolver = resolver || (await createContestResolver(env));

  const contest = contestResolver.getContest(electionId, contestId);
  if (!contest.rank_distribution) {
    throw new Error(
      `Rank distribution data not available for contest ${electionId}/${contestId}`,
    );
  }

  const uri = contestResolver.resolveArtifactUrl(contest.rank_distribution);

  // Use hyparquet to read parquet file directly with contract validation
  const data = await parseAllRowsFromParquet(uri, RankDistributionOutput);

  const contestData = contestResolver.getContest(electionId, contestId);
  const election = contestResolver.getElection(electionId);

  return {
    data,
    contest: contestData,
    election,
  };
}
