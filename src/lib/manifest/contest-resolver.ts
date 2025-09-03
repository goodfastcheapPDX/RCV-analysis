import { readFileSync } from "node:fs";
import type { Manifest } from "@/contracts/manifest";
import { findContest, findElection } from "@/contracts/manifest";
import { loadManifest, loadManifestSync } from "@/lib/manifest";

/**
 * Contest resolver for validated manifest reading
 */
export class ContestResolver {
  private manifest: Manifest;

  constructor(manifest: Manifest) {
    this.manifest = manifest;
  }

  /**
   * Get election by ID with validation
   */
  getElection(electionId: string) {
    const election = findElection(this.manifest, electionId);
    if (!election) {
      throw new Error(`Election ${electionId} not found`);
    }
    return election;
  }

  /**
   * Get contest by election and contest ID with validation
   */
  getContest(electionId: string, contestId: string) {
    const contest = findContest(this.manifest, electionId, contestId);
    if (!contest) {
      throw new Error(`Contest ${electionId}/${contestId} not found`);
    }
    return contest;
  }

  /**
   * Get all contests for an election
   */
  getContestsForElection(electionId: string) {
    const election = this.getElection(electionId);
    return election.contests;
  }

  /**
   * Check if contest has first-choice data
   */
  hasFirstChoiceData(electionId: string, contestId: string): boolean {
    const contest = this.getContest(electionId, contestId);
    return !!contest.first_choice;
  }

  /**
   * Check if contest has STV data
   */
  hasStvData(electionId: string, contestId: string): boolean {
    const contest = this.getContest(electionId, contestId);
    return !!contest.stv.rounds;
  }

  /**
   * Get first-choice data URI for contest
   */
  getFirstChoiceUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.first_choice?.uri ?? null;
  }

  /**
   * Get STV rounds URI for contest
   */
  getStvRoundsUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.stv.rounds?.uri ?? null;
  }

  /**
   * Get STV meta URI for contest
   */
  getStvMetaUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.stv.meta?.uri ?? null;
  }

  /**
   * Get candidates URI for contest
   */
  getCandidatesUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.cvr.candidates?.uri ?? null;
  }

  /**
   * Get ballots_long URI for contest
   */
  getBallotsLongUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.cvr.ballots_long?.uri ?? null;
  }

  /**
   * Get rank distribution URI for contest
   */
  getRankDistributionUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.rank_distribution?.uri ?? null;
  }

  /**
   * Get transfer matrix URI for contest
   * Note: Transfer matrix is not yet in manifest, so we construct the path
   */
  getTransferMatrixUri(electionId: string, contestId: string): string | null {
    // For now, construct the expected path since transfer matrix is not in manifest
    // TODO: Add transfer_matrix to manifest schema
    return `data/${this.manifest.env}/${electionId}/${contestId}/transfer_matrix/transfer_matrix.parquet`;
  }
}

/**
 * Create contest resolver from manifest (async)
 */
export async function createContestResolver(
  env?: string,
): Promise<ContestResolver> {
  const manifest = await loadManifest(env);
  return new ContestResolver(manifest);
}

/**
 * Create contest resolver from manifest (sync)
 */
export function createContestResolverSync(env?: string): ContestResolver {
  const manifest = loadManifestSync(env);
  return new ContestResolver(manifest);
}
