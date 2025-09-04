import { Manifest as ManifestV2 } from "@/contracts/manifest";
import { getDataEnv, isStaticBuild } from "@/lib/env";

/**
 * Load the v2 manifest via HTTP (works in both browser and Node.js)
 */
export async function loadManifest(env?: string): Promise<ManifestV2> {
  const dataEnv = env || getDataEnv();
  const manifestPath = `/data/${dataEnv}/manifest.json`;

  // During static build, read from filesystem
  if (isStaticBuild()) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.join(process.cwd(), "public", manifestPath);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return ManifestV2.parse(parsed);
  }

  // Runtime: Determine base URL for HTTP loading
  let baseUrl = process.env.DATA_BASE_URL;

  // In production on Vercel, fallback to VERCEL_URL if DATA_BASE_URL isn't set
  if (!baseUrl && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }

  // If no base URL, use empty string for relative URLs (browser context)
  if (!baseUrl) {
    baseUrl = "";
  }

  const manifestUrl: string = `${baseUrl}${manifestPath}`;

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
