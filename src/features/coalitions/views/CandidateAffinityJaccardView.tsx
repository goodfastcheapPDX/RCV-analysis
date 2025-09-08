"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Output as CandidateAffinityJaccardOutput,
  Stats as CandidateAffinityJaccardStats,
} from "@/contracts/slices/candidate_affinity_jaccard/index.contract";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import { CoalitionHeatmapBase } from "../common/CoalitionHeatmapBase";
import { Controls } from "../common/Controls";
import {
  getCandidateName,
  getCanonicalPairKey,
  getLastName,
  useSortedCandidates,
} from "../common/utils";

interface CandidateAffinityJaccardViewProps {
  jaccardData: CandidateAffinityJaccardOutput[];
  stats: CandidateAffinityJaccardStats;
  candidates?: CandidatesOutput[];
  electionId?: string;
  contestId?: string;
}

export function CandidateAffinityJaccardView({
  jaccardData,
  stats,
  candidates,
}: CandidateAffinityJaccardViewProps) {
  const [minThreshold, setMinThreshold] = useState<number[]>([0]);
  const [showTopK, setShowTopK] = useState(false);
  const [topK, setTopK] = useState<number[]>([100]);

  // Get all unique candidate IDs from the data
  const allCandidateIds = useMemo(() => {
    return Array.from(
      new Set([
        ...jaccardData.map((d) => d.candidate_a),
        ...jaccardData.map((d) => d.candidate_b),
      ]),
    );
  }, [jaccardData]);

  // Use the shared hook for sorting candidates
  const sortedCandidateIds = useSortedCandidates(candidates, allCandidateIds);

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
    let filtered = jaccardData.filter((d) => d.jaccard >= minThreshold[0]);

    if (showTopK) {
      filtered = filtered
        .sort((a, b) => b.jaccard - a.jaccard)
        .slice(0, topK[0]);
    }

    return filtered;
  }, [jaccardData, minThreshold, showTopK, topK]);

  // Build pair lookup map
  const pairLookup = useMemo(() => {
    const lookup = new Map<string, CandidateAffinityJaccardOutput>();
    for (const item of filteredData) {
      const key = `${item.candidate_a}-${item.candidate_b}`;
      lookup.set(key, item);
    }
    return lookup;
  }, [filteredData]);

  // Build symmetric values for Jaccard matrix
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

          // Extract jaccard value instead of cooccurrence_frac
          result[matrixKey] = pairData ? pairData.jaccard : 0;
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
        jaccard: number;
        pair_count: number;
        union_count: number;
        presence_a: number;
        presence_b: number;
      }
    >();
    for (const item of jaccardData) {
      const key = `${item.candidate_a}-${item.candidate_b}`;
      lookup.set(key, {
        jaccard: item.jaccard,
        pair_count: item.pair_count,
        union_count: item.union_count,
        presence_a: item.presence_a,
        presence_b: item.presence_b,
      });
    }
    return lookup;
  }, [jaccardData]);

  // Format tooltip for Jaccard data
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
              <strong>Jaccard:</strong> {(value * 100).toFixed(1)}%
            </div>
            {pairData && (
              <>
                <div>
                  <strong>Together:</strong>{" "}
                  {pairData.pair_count.toLocaleString()} ballots
                </div>
                <div>
                  <strong>Union:</strong>{" "}
                  {pairData.union_count.toLocaleString()} ballots
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {candidateAName}: {pairData.presence_a.toLocaleString()}{" "}
                  ballots
                  <br />
                  {candidateBName}: {pairData.presence_b.toLocaleString()}{" "}
                  ballots
                </div>
              </>
            )}
          </div>
        </div>
      );
    },
    [candidates, tooltipLookup],
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
            {(stats.max_jaccard * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Max Jaccard</div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-orange-600">
            {stats.zero_union_pairs.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Zero Union Pairs</div>
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
        minLabel="Minimum Jaccard Index"
        maxLabel="Max"
        min={0}
        max={stats.max_jaccard}
        step={0.001}
        showTopK={showTopK}
        setShowTopK={setShowTopK}
        topK={topK}
        setTopK={setTopK}
        topKEnabled={true}
        topKMax={stats.unique_pairs}
        topKLabel="by Jaccard index"
        filteredCount={filteredData.length}
        totalCount={stats.unique_pairs}
      />
    ),
    [
      minThreshold,
      stats.max_jaccard,
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
          <span>Low similarity (Jaccard &lt; 0.3)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span>High similarity (Jaccard &gt; 0.7)</span>
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
          <strong>Interpretation:</strong> The Jaccard index normalizes
          co-occurrence to discount "big candidate" popularity effects. Each
          cell shows J(A,B) = |A∩B| / |A∪B|, where A and B are sets of ballots
          containing each candidate.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Assumptions:</strong> No rank conditioning; any-rank presence;
          canonical unordered pairs; no smoothing; no priors.
        </p>
      </div>
    ),
    [],
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
              <strong>Jaccard:</strong> {(value * 100).toFixed(1)}%
            </div>
            {pairData && (
              <>
                <div>
                  <strong>Together:</strong>{" "}
                  {pairData.pair_count.toLocaleString()} ballots
                </div>
                <div>
                  <strong>Union:</strong>{" "}
                  {pairData.union_count.toLocaleString()} ballots
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {candidateAName}: {pairData.presence_a.toLocaleString()}{" "}
                  ballots
                  <br />
                  {candidateBName}: {pairData.presence_b.toLocaleString()}{" "}
                  ballots
                </div>
              </>
            )}
          </div>
        </>
      );
    },
    [candidates, tooltipLookup],
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
      maxValue={stats.max_jaccard}
      formatTooltip={formatTooltip}
      formatPinnedContent={formatPinnedContent}
      controls={controls}
      title="Candidate Affinity Jaccard Matrix"
      description="Heatmap showing normalized similarity between candidates using the Jaccard index. 
        This metric discounts popularity effects by measuring the overlap of candidate 
        support relative to their combined presence across all ballots."
      headerStats={headerStats}
      legend={legend}
      interpretation={interpretation}
      formatAxisLabel={formatAxisLabel}
    />
  );
}
