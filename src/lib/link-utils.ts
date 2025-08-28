import type { ReadonlyURLSearchParams } from "next/navigation";

export function preserveQueryParams(
  basePath: string,
  searchParams?: ReadonlyURLSearchParams | URLSearchParams | null,
): string {
  if (!searchParams) return basePath;

  const vParam = searchParams.get("v");
  if (!vParam) return basePath;

  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}v=${encodeURIComponent(vParam)}`;
}

export function createLinkWithVersion(
  basePath: string,
  searchParams?: ReadonlyURLSearchParams | URLSearchParams | null,
): string {
  return preserveQueryParams(basePath, searchParams);
}
