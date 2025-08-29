import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import {
  findContest,
  getArtifactUri,
  Manifest as ManifestV2,
} from "@/contracts/manifest";
import { getDataEnv } from "./env";

/**
 * Load the v2 manifest from the filesystem
 */
export async function loadManifest(env?: string): Promise<ManifestV2> {
  const dataEnv = env || getDataEnv();
  const manifestPath = `data/${dataEnv}/manifest.json`;

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return ManifestV2.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load manifest from ${manifestPath}: ${error.message}`,
      );
    }
    throw new Error(
      `Failed to load manifest from ${manifestPath}: Unknown error`,
    );
  }
}

/**
 * Load manifest synchronously for use in Next.js API routes
 */
export function loadManifestSync(env?: string): ManifestV2 {
  const dataEnv = env || getDataEnv();
  const manifestPath = `data/${dataEnv}/manifest.json`;

  try {
    const raw = readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return ManifestV2.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load manifest from ${manifestPath}: ${error.message}`,
      );
    }
    throw new Error(
      `Failed to load manifest from ${manifestPath}: Unknown error`,
    );
  }
}

/**
 * Get artifact data for a specific contest
 */
export function getContestArtifacts(
  manifest: ManifestV2,
  electionId: string,
  contestId: string,
) {
  const contest = findContest(manifest, electionId, contestId);
  if (!contest) {
    throw new Error(`Contest ${electionId}/${contestId} not found in manifest`);
  }

  return {
    contest,
    candidates: contest.cvr.candidates
      ? getArtifactUri(contest.cvr.candidates)
      : null,
    ballotsLong: contest.cvr.ballots_long
      ? getArtifactUri(contest.cvr.ballots_long)
      : null,
    firstChoice: contest.first_choice
      ? getArtifactUri(contest.first_choice)
      : null,
    stvRounds: contest.stv.rounds ? getArtifactUri(contest.stv.rounds) : null,
    stvMeta: contest.stv.meta ? getArtifactUri(contest.stv.meta) : null,
  };
}

// Re-export types and utilities from the contract
export {
  findContest,
  findElection,
  getArtifactUri,
  type Manifest,
} from "@/contracts/manifest";

// Legacy types for backward compatibility
export type Contest = {
  id: string;
  name: string;
  seats: number;
};

export type Election = {
  id: string;
  name: string;
  contests: Contest[];
};

export type ManifestT = {
  elections: Election[];
};
