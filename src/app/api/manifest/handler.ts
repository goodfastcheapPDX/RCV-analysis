import { loadManifest } from "@/lib/manifest";

export async function handleManifestRequest(env?: string) {
  try {
    const manifest = await loadManifest(env);
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
