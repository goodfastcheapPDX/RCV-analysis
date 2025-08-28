import fs from "node:fs/promises";
import { z } from "zod";

const Contest = z.object({
  id: z.string(),
  name: z.string(),
  seats: z.number().int().positive(),
});

const Election = z.object({
  id: z.string(),
  name: z.string(),
  contests: z.array(Contest).nonempty(),
});

export const Manifest = z.object({
  buildId: z.string().min(6),
  elections: z.array(Election).nonempty(),
});

export type Contest = z.infer<typeof Contest>;
export type Election = z.infer<typeof Election>;
export type ManifestT = z.infer<typeof Manifest>;

export async function loadManifestFromFs(
  path = "manifest.json",
): Promise<ManifestT> {
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Manifest.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load manifest from ${path}: ${error.message}`);
    }
    throw new Error(`Failed to load manifest from ${path}: Unknown error`);
  }
}
