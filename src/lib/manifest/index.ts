import { Manifest as ManifestV2 } from "@/contracts/manifest";
import { getDataEnv } from "@/lib/env";

/**
 * Load the v2 manifest via HTTP (works in both browser and Node.js)
 */
export async function loadManifest(env?: string): Promise<ManifestV2> {
  const dataEnv = env || getDataEnv();
  const manifestPath = `/data/${dataEnv}/manifest.json`;

  // Determine base URL based on environment
  const manifestUrl: string = `${process.env.DATA_BASE_URL}${manifestPath}`;

  try {
    // Use fetch for HTTP loading (works in Node.js and browser)
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const raw = await response.text();
    const parsed = JSON.parse(raw);
    return ManifestV2.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load manifest from ${manifestUrl}: ${error.message}`,
      );
    }
    throw new Error(
      `Failed to load manifest from ${manifestUrl}: Unknown error`,
    );
  }
}

// Re-export types and utilities from the contract
export {
  findContest,
  findElection,
  getArtifactUri,
  type Manifest,
} from "@/contracts/manifest";
