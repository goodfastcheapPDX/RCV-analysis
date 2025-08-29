/**
 * URL parameter preservation utilities for maintaining state across navigation
 */

/**
 * Merges current URL query parameters with a target href, preserving specified keys
 * @param href - Target URL to navigate to
 * @param preserveKeys - Array of query parameter keys to preserve (defaults to ["v"])
 * @returns URL with preserved query parameters merged
 *
 * @example
 * // Current URL: /some/page?v=abc123&other=value
 * withPreservedQuery("/new/page", ["v"])
 * // Returns: "/new/page?v=abc123"
 *
 * withPreservedQuery("/new/page?existing=param", ["v", "other"])
 * // Returns: "/new/page?existing=param&v=abc123&other=value"
 */
export function withPreservedQuery(
  href: string,
  preserveKeys: string[] = ["v"],
): string {
  // Handle server-side rendering where window is undefined
  if (typeof window === "undefined") {
    return href;
  }

  const currentParams = new URLSearchParams(window.location.search);
  const [basePath, existingQuery] = href.split("?");
  const targetParams = new URLSearchParams(existingQuery || "");

  // Preserve specified parameters from current URL
  for (const key of preserveKeys) {
    const currentValue = currentParams.get(key);
    if (currentValue && !targetParams.has(key)) {
      targetParams.set(key, currentValue);
    }
  }

  const queryString = targetParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Server-safe version that accepts current search params explicitly
 * Useful for server components where window.location is not available
 *
 * @param href - Target URL to navigate to
 * @param currentSearchParams - URLSearchParams from current request
 * @param preserveKeys - Array of query parameter keys to preserve (defaults to ["v"])
 * @returns URL with preserved query parameters merged
 */
export function withPreservedQuerySSR(
  href: string,
  currentSearchParams: URLSearchParams,
  preserveKeys: string[] = ["v"],
): string {
  const [basePath, existingQuery] = href.split("?");
  const targetParams = new URLSearchParams(existingQuery || "");

  // Preserve specified parameters from current request
  for (const key of preserveKeys) {
    const currentValue = currentSearchParams.get(key);
    if (currentValue && !targetParams.has(key)) {
      targetParams.set(key, currentValue);
    }
  }

  const queryString = targetParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
