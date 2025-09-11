import { useMemo } from "react";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";

// Types for affinity data that can provide ballot frequency information
interface AffinityDataWithFrequency {
  candidate_a: number;
  candidate_b: number;
}

interface JaccardDataWithFrequency {
  candidate_a: number;
  candidate_b: number;
  presence_a: number;
  presence_b: number;
}

interface ProximityDataWithFrequency {
  candidate_a: number;
  candidate_b: number;
  pair_count: number;
}

type AffinityDataTypes =
  | AffinityDataWithFrequency
  | JaccardDataWithFrequency
  | ProximityDataWithFrequency;

/**
 * Calculate ballot frequency for each candidate from affinity data
 */
function calculateBallotFrequency(
  affinityData?: AffinityDataTypes[],
): Map<number, number> {
  const frequencyMap = new Map<number, number>();

  if (!affinityData || affinityData.length === 0) {
    return frequencyMap;
  }

  // Check if this is Jaccard data (has presence_a and presence_b)
  const isJaccardData = (
    data: AffinityDataTypes,
  ): data is JaccardDataWithFrequency =>
    "presence_a" in data && "presence_b" in data;

  if (isJaccardData(affinityData[0])) {
    // Use presence_a and presence_b directly from Jaccard data
    for (const item of affinityData as JaccardDataWithFrequency[]) {
      frequencyMap.set(item.candidate_a, item.presence_a);
      frequencyMap.set(item.candidate_b, item.presence_b);
    }
    return frequencyMap;
  }

  // For Raw affinity matrix and Proximity data, calculate from co-occurrence data
  // Each candidate's ballot frequency is the sum of all pair counts involving that candidate
  const candidatePairCounts = new Map<number, number[]>();

  for (const item of affinityData) {
    const pairCount =
      "pair_count" in item
        ? item.pair_count
        : "cooccurrence_count" in item
          ? (item as { cooccurrence_count: number }).cooccurrence_count
          : 0;

    if (!candidatePairCounts.has(item.candidate_a)) {
      candidatePairCounts.set(item.candidate_a, []);
    }
    if (!candidatePairCounts.has(item.candidate_b)) {
      candidatePairCounts.set(item.candidate_b, []);
    }

    candidatePairCounts.get(item.candidate_a)?.push(pairCount);
    candidatePairCounts.get(item.candidate_b)?.push(pairCount);
  }

  // For non-Jaccard data, we need to estimate ballot frequency
  // This is approximate because we don't have direct presence counts
  for (const [candidateId, pairCounts] of candidatePairCounts) {
    // Use the maximum pair count as an approximation of ballot frequency
    // This is conservative but reasonable for sorting purposes
    frequencyMap.set(candidateId, Math.max(...pairCounts));
  }

  return frequencyMap;
}

/**
 * Hook to get sorted candidates by ballot frequency (descending)
 */
export function useSortedCandidatesByFrequency<T extends AffinityDataTypes>(
  affinityData?: T[],
  candidates?: CandidatesOutput[],
  fallbackIds: number[] = [],
) {
  return useMemo(() => {
    const ballotFrequency = calculateBallotFrequency(affinityData);

    // Get all candidate IDs
    let candidateIds: number[];
    if (affinityData && affinityData.length > 0) {
      candidateIds = Array.from(
        new Set([
          ...affinityData.map((d) => d.candidate_a),
          ...affinityData.map((d) => d.candidate_b),
        ]),
      );
    } else if (candidates && candidates.length > 0) {
      candidateIds = candidates.map((c) => c.candidate_id);
    } else {
      candidateIds = fallbackIds;
    }

    // Sort by ballot frequency (descending), then by name as tiebreaker
    return candidateIds.sort((a, b) => {
      const freqA = ballotFrequency.get(a) || 0;
      const freqB = ballotFrequency.get(b) || 0;

      if (freqA !== freqB) {
        return freqB - freqA; // Higher frequency first
      }

      // Tiebreaker: sort by candidate name if available
      if (candidates) {
        const candidateA = candidates.find((c) => c.candidate_id === a);
        const candidateB = candidates.find((c) => c.candidate_id === b);
        if (candidateA && candidateB) {
          return candidateA.candidate_name.localeCompare(
            candidateB.candidate_name,
          );
        }
      }

      // Final fallback: sort by candidate ID
      return a - b;
    });
  }, [affinityData, candidates, fallbackIds]);
}

/**
 * Hook to get sorted candidates with consistent last name formatting
 * @deprecated Use useSortedCandidatesByFrequency for ballot frequency ordering
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
