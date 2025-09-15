import { logError, loggers } from "@/lib/logger";
import { loadManifest } from "@/lib/manifest";

export async function handleManifestRequest(_env?: string) {
  try {
    const manifest = await loadManifest();
    loggers.api.info("Manifest loaded successfully");
    return { success: true, data: manifest };
  } catch (error) {
    logError(loggers.api, error, { operation: "loadManifest" });
    return {
      success: false,
      error: "Failed to load manifest",
      status: 500,
    };
  }
}
