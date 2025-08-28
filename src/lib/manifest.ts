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

export async function loadManifest(path = "manifest.json"): Promise<ManifestT> {
  const raw = await fs.readFile(path, "utf8");
  return Manifest.parse(JSON.parse(raw));
}
