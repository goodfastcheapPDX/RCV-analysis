import type { ArtifactRef, Manifest } from "@/contracts/manifest";
import { findContest, findElection } from "@/contracts/manifest";
import { loadManifest } from "@/lib/manifest";

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
   */
  getTransferMatrixUri(electionId: string, contestId: string): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.transfer_matrix?.uri ?? null;
  }

  /**
   * Get candidate affinity matrix URI for contest
   * Note: Candidate affinity matrix is not yet in manifest, so we construct the path
   */
  getCandidateAffinityMatrixUri(
    electionId: string,
    contestId: string,
  ): string | null {
    // Return HTTP URL since all data is now in public/data
    return `/data/${this.manifest.env}/${electionId}/${contestId}/candidate_affinity_matrix/candidate_affinity_matrix.parquet`;
  }

  /**
   * Get candidate affinity jaccard URI for contest
   */
  getCandidateAffinityJaccardUri(
    electionId: string,
    contestId: string,
  ): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.candidate_affinity_jaccard?.uri ?? null;
  }

  /**
   * Get candidate affinity proximity URI for contest
   */
  getCandidateAffinityProximityUri(
    electionId: string,
    contestId: string,
  ): string | null {
    const contest = this.getContest(electionId, contestId);
    return contest.candidate_affinity_proximity?.uri ?? null;
  }

  /**
   * Resolve artifact to HTTP URL (works for both DuckDB and browser)
   */
  resolveArtifactUrl(artifact: ArtifactRef): string {
    // All artifacts are now served via HTTP from /data/{env}/...
    // Convert data/dev/path -> /data/dev/path for HTTP access
    let uri = artifact.uri;
    if (!uri.startsWith("/")) {
      uri = `/${uri}`;
    }

    // Determine base URL with fallbacks
    let baseUrl = process.env.DATA_BASE_URL;

    // In production on Vercel, fallback to VERCEL_URL if DATA_BASE_URL isn't set
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }

    // If still no base URL, assume we're in browser context and use relative URLs
    if (!baseUrl) {
      baseUrl = "";
    }

    // In Node.js (DuckDB), we need full HTTP URLs
    return `${baseUrl}${uri}`;
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
