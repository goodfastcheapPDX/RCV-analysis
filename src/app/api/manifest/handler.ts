import { loadManifestSync } from "@/lib/manifest";

export async function handleManifestRequest() {
  try {
    const manifest = await loadManifestSync();
    return { success: true, data: manifest };
  } catch (error) {
    console.error("Failed to load manifest:", error);
    return {
      success: false,
      error: "Failed to load manifest",
      status: 500,
    };
  }
}
