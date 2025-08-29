import type { MetadataRoute } from "next";
import { loadManifest } from "@/lib/manifest";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/e`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/learn`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    const manifest = await loadManifest();
    const dynamicRoutes: MetadataRoute.Sitemap = [];

    for (const election of manifest.elections) {
      // Election pages
      dynamicRoutes.push({
        url: `${baseUrl}/e/${election.id}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });

      // Contest pages
      for (const contest of election.contests) {
        dynamicRoutes.push({
          url: `${baseUrl}/e/${election.id}/c/${contest.id}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.9,
        });
      }
    }

    return [...staticRoutes, ...dynamicRoutes];
  } catch (error) {
    console.error("Failed to load manifest for sitemap:", error);
    return staticRoutes;
  }
}
