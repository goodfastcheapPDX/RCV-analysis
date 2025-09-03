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
   * Note: Transfer matrix is not yet in manifest, so we construct the path
   */
  getTransferMatrixUri(electionId: string, contestId: string): string | null {
    // Return HTTP URL since all data is now in public/data
    return `/data/${this.manifest.env}/${electionId}/${contestId}/transfer_matrix/transfer_matrix.parquet`;
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
    
    // In Node.js (DuckDB), we need full HTTP URLs
    if (typeof window === "undefined") {
      const testBaseUrl = process.env.TEST_DATA_BASE_URL;
      const baseUrl = testBaseUrl || "http://localhost:3001";
      return `${baseUrl}${uri}`;
    }
    
    return uri;
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
 * Create contest resolver from manifest (sync) - DEPRECATED
 * TODO: Remove once all callers use async createContestResolver
 * For now, falls back to filesystem loading for backward compatibility
 */
export function createContestResolverSync(env?: string): ContestResolver {
  // Temporary fallback: read from filesystem for sync calls during migration
  const { readFileSync } = require("node:fs");
  const { getDataEnv } = require("@/lib/env");
  const { Manifest } = require("@/contracts/manifest");
  
  const dataEnv = env || getDataEnv();
  const manifestPath = `data/${dataEnv}/manifest.json`;
  
  try {
    const raw = readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    const manifest = Manifest.parse(parsed);
    return new ContestResolver(manifest);
  } catch (error) {
    // If filesystem fails, user should migrate to async
    throw new Error(
      `createContestResolverSync failed to read from ${manifestPath}. Please use async createContestResolver() instead.`
    );
  }
}
