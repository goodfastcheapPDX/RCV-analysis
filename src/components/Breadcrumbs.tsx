"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { withPreservedQuery } from "@/lib/url-preserve";
import type { ManifestT } from "@/packages/contracts/lib/manifest";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const [manifest, setManifest] = useState<ManifestT | null>(null);

  // Load manifest on client side
  useEffect(() => {
    async function loadManifest() {
      try {
        const response = await fetch("/api/manifest");
        if (response.ok) {
          const manifestData = await response.json();
          setManifest(manifestData);
        }
      } catch (error) {
        console.warn("Failed to load manifest for breadcrumbs:", error);
      }
    }
    loadManifest();
  }, []);

  // Generate breadcrumb segments based on current path
  const generateBreadcrumbs = (): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [];

    // Always show Home for non-root paths
    if (pathname !== "/") {
      segments.push({ label: "Home", href: "/" });
    }

    // Parse path segments
    const pathParts = pathname.split("/").filter(Boolean);

    if (pathParts.length === 0) {
      return segments;
    }

    // Handle /e (Elections)
    if (pathParts[0] === "e") {
      if (pathParts.length === 1) {
        // /e - just show Elections (current page)
        segments.push({ label: "Elections" });
      } else if (pathParts.length >= 2) {
        // /e/[electionId] or deeper
        segments.push({ label: "Elections", href: "/e" });

        const electionId = pathParts[1];
        const election = manifest?.elections.find((e) => e.id === electionId);
        const electionName = election?.name || electionId;

        if (pathParts.length === 2) {
          // /e/[electionId] - show election name (current page)
          segments.push({ label: electionName });
        } else if (pathParts.length >= 4 && pathParts[2] === "c") {
          // /e/[electionId]/c/[contestId] or deeper
          segments.push({ label: electionName, href: `/e/${electionId}` });

          const contestId = pathParts[3];
          const contest = election?.contests.find((c) => c.id === contestId);
          const contestName = contest?.name || contestId;

          if (pathParts.length === 4) {
            // /e/[electionId]/c/[contestId] - show contest name (current page)
            segments.push({ label: contestName });
          } else {
            // Deeper than contest - show contest as link
            segments.push({
              label: contestName,
              href: `/e/${electionId}/c/${contestId}`,
            });

            // For any additional segments, show the path segment as-is
            for (let i = 4; i < pathParts.length; i++) {
              const isLast = i === pathParts.length - 1;
              const segmentPath = "/" + pathParts.slice(0, i + 1).join("/");
              segments.push({
                label: pathParts[i],
                href: isLast ? undefined : segmentPath,
              });
            }
          }
        }
      }
    } else if (pathParts[0] === "learn") {
      segments.push({ label: "Learn" });
    } else if (pathParts[0] === "about") {
      segments.push({ label: "About" });
    } else {
      // For other paths, show segments as-is
      for (let i = 0; i < pathParts.length; i++) {
        const isLast = i === pathParts.length - 1;
        const segmentPath = "/" + pathParts.slice(0, i + 1).join("/");
        segments.push({
          label: pathParts[i],
          href: isLast ? undefined : segmentPath,
        });
      }
    }

    return segments;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't render breadcrumbs for home page or if we only have one segment
  if (pathname === "/" || breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((segment, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div
              key={`${segment.label}-${index}`}
              className="flex items-center"
            >
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage className="font-medium">
                    {segment.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={withPreservedQuery(segment.href)}
                      className="hover:text-foreground transition-colors"
                    >
                      {segment.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
