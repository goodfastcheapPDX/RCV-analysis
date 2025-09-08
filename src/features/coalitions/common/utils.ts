import { useMemo } from "react";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";

/**
 * Hook to get sorted candidates with consistent last name formatting
 */
export function useSortedCandidates(
  candidates?: CandidatesOutput[],
  fallbackIds: number[] = [],
) {
  return useMemo(() => {
    if (candidates && candidates.length > 0) {
      // Sort by candidate name for consistent ordering
      return candidates
        .sort((a, b) => a.candidate_name.localeCompare(b.candidate_name))
        .map((c) => c.candidate_id);
    }

    // Fallback to numeric sorting of IDs
    return fallbackIds.sort((a, b) => a - b);
  }, [candidates, fallbackIds]);
}

/**
 * Helper to get candidate name from candidate_id
 */
export function getCandidateName(
  candidateId: number,
  candidates?: CandidatesOutput[],
): string {
  if (!candidates) return candidateId.toString();
  const candidate = candidates.find((c) => c.candidate_id === candidateId);
  return candidate ? candidate.candidate_name : candidateId.toString();
}

/**
 * Helper to get last name for axis labels
 */
export function getLastName(
  candidateId: number,
  candidates?: CandidatesOutput[],
): string {
  const fullName = getCandidateName(candidateId, candidates);
  const nameParts = fullName.split(" ");
  return nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;
}

/**
 * Build symmetric getter for pair data with diagonal zeroing
 * Works with any pair data structure that contains cooccurrence_frac
 */
export function buildSymmetricGetter<T extends { cooccurrence_frac: number }>(
  pairMap: Map<string, T>,
  getKey: (a: number, b: number) => string,
): Record<string, number> {
  const result: Record<string, number> = {};

  // Get all unique candidate IDs from the pair map
  const candidateIds = new Set<number>();
  for (const key of pairMap.keys()) {
    const [aStr, bStr] = key.split("-");
    candidateIds.add(parseInt(aStr, 10));
    candidateIds.add(parseInt(bStr, 10));
  }

  // Build symmetric matrix with diagonal = 0
  for (const candidateA of candidateIds) {
    for (const candidateB of candidateIds) {
      const matrixKey = `${candidateA}-${candidateB}`;

      if (candidateA === candidateB) {
        // Diagonal = 0
        result[matrixKey] = 0;
      } else {
        // Look up canonical pair
        const canonicalKey = getKey(candidateA, candidateB);
        const pairData = pairMap.get(canonicalKey);

        // Extract cooccurrence_frac value
        result[matrixKey] = pairData ? pairData.cooccurrence_frac : 0;
      }
    }
  }

  return result;
}

/**
 * Generate canonical pair key (lexicographic ordering)
 */
export function getCanonicalPairKey(
  candidateA: number,
  candidateB: number,
): string {
  const canonicalA = candidateA < candidateB ? candidateA : candidateB;
  const canonicalB = candidateA < candidateB ? candidateB : candidateA;
  return `${canonicalA}-${canonicalB}`;
}
