"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Output as CandidateAffinityProximityOutput,
  Stats as CandidateAffinityProximityStats,
} from "@/contracts/slices/candidate_affinity_proximity/index.contract";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import { CoalitionHeatmapBase } from "../common/CoalitionHeatmapBase";
import { Controls } from "../common/Controls";
import {
  getCandidateName,
  getCanonicalPairKey,
  getLastName,
  useSortedCandidatesByFrequency,
} from "../common/utils";

interface CandidateAffinityProximityViewProps {
  proximityData: CandidateAffinityProximityOutput[];
  stats: CandidateAffinityProximityStats;
  candidates?: CandidatesOutput[];
  electionId?: string;
  contestId?: string;
}

export function CandidateAffinityProximityView({
  proximityData,
  stats,
  candidates,
}: CandidateAffinityProximityViewProps) {
  const [minThreshold, setMinThreshold] = useState<number[]>([0]);
  const [showTopK, setShowTopK] = useState(false);
  const [topK, setTopK] = useState<number[]>([100]);

  // Get all unique candidate IDs from the data
  const allCandidateIds = useMemo(() => {
    return Array.from(
      new Set([
        ...proximityData.map((d) => d.candidate_a),
        ...proximityData.map((d) => d.candidate_b),
      ]),
    );
  }, [proximityData]);

  // Use ballot frequency sorting for candidates
  const sortedCandidateIds = useSortedCandidatesByFrequency(
    proximityData,
    candidates,
    allCandidateIds,
  );

  // Convert to string arrays for the base component
  const rows = useMemo(
    () => sortedCandidateIds.map((id) => id.toString()),
    [sortedCandidateIds],
  );
  const cols = useMemo(
    () => sortedCandidateIds.map((id) => id.toString()),
    [sortedCandidateIds],
  );

  // Filter data based on threshold and topK
  const filteredData = useMemo(() => {
    let filtered = proximityData.filter((d) => d.weight_sum >= minThreshold[0]);

    if (showTopK) {
      filtered = filtered
        .sort((a, b) => b.weight_sum - a.weight_sum)
        .slice(0, topK[0]);
    }

    return filtered;
  }, [proximityData, minThreshold, showTopK, topK]);

  // Build pair lookup map
  const pairLookup = useMemo(() => {
    const lookup = new Map<string, CandidateAffinityProximityOutput>();
    for (const item of filteredData) {
      const key = `${item.candidate_a}-${item.candidate_b}`;
      lookup.set(key, item);
    }
    return lookup;
  }, [filteredData]);

  // Build symmetric values for Proximity matrix
  const values = useMemo(() => {
    const result: Record<string, number> = {};

    // Get all unique candidate IDs from the pair map
    const candidateIds = new Set<number>();
    for (const key of pairLookup.keys()) {
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
          const canonicalKey = getCanonicalPairKey(candidateA, candidateB);
          const pairData = pairLookup.get(canonicalKey);

          // Extract weight_sum value
          result[matrixKey] = pairData ? pairData.weight_sum : 0;
        }
      }
    }

    return result;
  }, [pairLookup]);

  // Tooltip data lookup for performance
  const tooltipLookup = useMemo(() => {
    const lookup = new Map<
      string,
      {
        weight_sum: number;
        pair_count: number;
        avg_distance: number;
      }
    >();
    for (const item of proximityData) {
      const key = `${item.candidate_a}-${item.candidate_b}`;
      lookup.set(key, {
        weight_sum: item.weight_sum,
        pair_count: item.pair_count,
        avg_distance: item.avg_distance,
      });
    }
    return lookup;
  }, [proximityData]);

  // Format tooltip for Proximity data
  const formatTooltip = useCallback(
    (rowId: string, colId: string, value: number) => {
      const candidateAId = parseInt(rowId, 10);
      const candidateBId = parseInt(colId, 10);
      const candidateAName = getCandidateName(candidateAId, candidates);
      const candidateBName = getCandidateName(candidateBId, candidates);

      if (candidateAId === candidateBId) {
        return (
          <div className="bg-background border rounded p-3 shadow-lg text-sm min-w-48">
            <strong>{candidateAName}</strong>
          </div>
        );
      }

      // Fast lookup using the memoized map
      const lookupKey = getCanonicalPairKey(candidateAId, candidateBId);
      const pairData = tooltipLookup.get(lookupKey);

      return (
        <div className="bg-background border rounded p-3 shadow-lg text-sm min-w-60">
          <div className="font-semibold">
            {candidateAName} ↔ {candidateBName}
          </div>
          <div className="mt-2 space-y-1">
            <div>
              <strong>Weight Sum:</strong> {value.toFixed(2)}
            </div>
            {pairData && (
              <>
                <div>
                  <strong>Pair Count:</strong>{" "}
                  {pairData.pair_count.toLocaleString()} ballots
                </div>
                <div>
                  <strong>Avg Distance:</strong>{" "}
                  {pairData.avg_distance.toFixed(2)} ranks
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Formula: w = α^(d-1) with α = {stats.alpha}
                  <br />
                  Adjacent ranks (d=1) contribute 1.0
                </div>
              </>
            )}
          </div>
        </div>
      );
    },
    [candidates, tooltipLookup, stats.alpha],
  );

  // Header stats component
  const headerStats = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
        <div className="space-y-1">
          <div className="text-2xl font-bold text-blue-600">
            {stats.total_ballots_considered.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">
            Ballots Considered
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-green-600">
            {stats.unique_pairs.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Unique Pairs</div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-purple-600">
            {stats.max_weight_sum.toFixed(2)}
          </div>
          <div className="text-sm text-muted-foreground">Max Weight Sum</div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-orange-600">
            α = {stats.alpha}
          </div>
          <div className="text-sm text-muted-foreground">Decay Factor</div>
        </div>
      </div>
    ),
    [stats],
  );

  // Controls component
  const controls = useMemo(
    () => (
      <Controls
        minThreshold={minThreshold}
        setMinThreshold={setMinThreshold}
        minLabel="Minimum Weight Sum"
        maxLabel="Max"
        min={0}
        max={stats.max_weight_sum}
        step={0.1}
        formatAsPercentage={false}
        showTopK={showTopK}
        setShowTopK={setShowTopK}
        topK={topK}
        setTopK={setTopK}
        topKEnabled={true}
        topKMax={stats.unique_pairs}
        topKLabel="by weight sum"
        filteredCount={filteredData.length}
        totalCount={stats.unique_pairs}
      />
    ),
    [
      minThreshold,
      stats.max_weight_sum,
      stats.unique_pairs,
      showTopK,
      topK,
      filteredData.length,
    ],
  );

  // Legend component
  const legend = useMemo(
    () => (
      <>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-100 border rounded" />
          <span>Self-pair (excluded)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-200 rounded" />
          <span>Low proximity weight</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span>High proximity weight</span>
        </div>
      </>
    ),
    [],
  );

  // Interpretation component
  const interpretation = useMemo(
    () => (
      <div className="space-y-2">
        <p>
          <strong>Interpretation:</strong> Proximity weighting emphasizes ballot
          pairs that appear near each other in rank order. Adjacent ranks (d=1)
          contribute full weight (1.0), while distant ranks contribute
          exponentially less (α^(d-1) with α = {stats.alpha}).
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Formula:</strong> For candidates A and B with ranks rA, rB:
          distance d = |rA - rB|, weight = {stats.alpha}^(d-1). Two ranks apart
          contributes {(stats.alpha ** 1).toFixed(2)}, three apart contributes{" "}
          {(stats.alpha ** 2).toFixed(3)}.
        </p>
      </div>
    ),
    [stats.alpha],
  );

  // Format pinned tooltip content (no card wrapper)
  const formatPinnedContent = useCallback(
    (rowId: string, colId: string, value: number) => {
      const candidateAId = parseInt(rowId, 10);
      const candidateBId = parseInt(colId, 10);
      const candidateAName = getCandidateName(candidateAId, candidates);
      const candidateBName = getCandidateName(candidateBId, candidates);

      if (candidateAId === candidateBId) {
        return <div className="font-semibold">{candidateAName}</div>;
      }

      // Fast lookup using the memoized map
      const lookupKey = getCanonicalPairKey(candidateAId, candidateBId);
      const pairData = tooltipLookup.get(lookupKey);

      return (
        <>
          <div className="font-semibold">
            {candidateAName} ↔ {candidateBName}
          </div>
          <div className="mt-2 space-y-1">
            <div>
              <strong>Weight Sum:</strong> {value.toFixed(2)}
            </div>
            {pairData && (
              <>
                <div>
                  <strong>Pair Count:</strong>{" "}
                  {pairData.pair_count.toLocaleString()} ballots
                </div>
                <div>
                  <strong>Avg Distance:</strong>{" "}
                  {pairData.avg_distance.toFixed(2)} ranks
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Formula: w = α^(d-1) with α = {stats.alpha}
                  <br />
                  Adjacent ranks (d=1) contribute 1.0
                </div>
              </>
            )}
          </div>
        </>
      );
    },
    [candidates, tooltipLookup, stats.alpha],
  );

  // Axis formatter
  const formatAxisLabel = useCallback(
    (candidateId: string) => getLastName(parseInt(candidateId, 10), candidates),
    [candidates],
  );

  return (
    <CoalitionHeatmapBase
      rows={rows}
      cols={cols}
      values={values}
      maxValue={stats.max_weight_sum}
      formatTooltip={formatTooltip}
      formatPinnedContent={formatPinnedContent}
      controls={controls}
      title="Candidate Affinity Proximity Matrix"
      description="Heatmap showing proximity-weighted candidate affinity. This metric emphasizes 
        pairs of candidates that appear close together in rank order, with adjacent 
        ranks contributing full weight and distant ranks contributing exponentially less."
      headerStats={headerStats}
      legend={legend}
      interpretation={interpretation}
      formatAxisLabel={formatAxisLabel}
    />
  );
}
