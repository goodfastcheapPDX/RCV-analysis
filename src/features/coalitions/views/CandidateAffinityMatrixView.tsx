"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Output as CandidateAffinityMatrixOutput,
  Stats as CandidateAffinityStats,
} from "@/contracts/slices/candidate_affinity_matrix/index.contract";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import { CoalitionHeatmapBase } from "../common/CoalitionHeatmapBase";
import { Controls } from "../common/Controls";
import {
  buildSymmetricGetter,
  getCandidateName,
  getCanonicalPairKey,
  getLastName,
  useSortedCandidates,
} from "../common/utils";

interface CandidateAffinityMatrixViewProps {
  affinityData: CandidateAffinityMatrixOutput[];
  stats: CandidateAffinityStats;
  candidates?: CandidatesOutput[];
  electionId?: string;
  contestId?: string;
}

export function CandidateAffinityMatrixView({
  affinityData,
  stats,
  candidates,
}: CandidateAffinityMatrixViewProps) {
  const [minThreshold, setMinThreshold] = useState<number[]>([0]);
  const [showTopK, setShowTopK] = useState(false);
  const [topK, setTopK] = useState<number[]>([100]);

  // Get all unique candidate IDs from the data
  const allCandidateIds = useMemo(() => {
    return Array.from(
      new Set([
        ...affinityData.map((d) => d.candidate_a),
        ...affinityData.map((d) => d.candidate_b),
      ]),
    );
  }, [affinityData]);

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
    let filtered = affinityData.filter(
      (d) => d.cooccurrence_frac >= minThreshold[0],
    );

    if (showTopK) {
      filtered = filtered
        .sort((a, b) => b.cooccurrence_frac - a.cooccurrence_frac)
        .slice(0, topK[0]);
    }

    return filtered;
  }, [affinityData, minThreshold, showTopK, topK]);

  // Build pair lookup map
  const pairLookup = useMemo(() => {
    const lookup = new Map<string, CandidateAffinityMatrixOutput>();
    for (const item of filteredData) {
      const key = `${item.candidate_a}-${item.candidate_b}`;
      lookup.set(key, item);
    }
    return lookup;
  }, [filteredData]);

  // Build symmetric values using the shared utility
  const values = useMemo(() => {
    return buildSymmetricGetter(pairLookup, getCanonicalPairKey);
  }, [pairLookup]);

  // Tooltip data lookup for performance
  const tooltipLookup = useMemo(() => {
    const lookup = new Map<string, { count: number; frac: number }>();
    for (const item of affinityData) {
      const key = `${item.candidate_a}-${item.candidate_b}`;
      lookup.set(key, {
        count: item.cooccurrence_count,
        frac: item.cooccurrence_frac,
      });
    }
    return lookup;
  }, [affinityData]);

  // Format tooltip for Raw data
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
        <div className="bg-background border rounded p-3 shadow-lg text-sm min-w-48">
          <div className="font-semibold">
            {candidateAName} ↔ {candidateBName}
          </div>
          <div className="mt-1">
            {pairData ? pairData.count.toLocaleString() : 0} ballots
          </div>
          <div className="text-muted-foreground">
            {(value * 100).toFixed(1)}% of all ballots
          </div>
        </div>
      );
    },
    [candidates, tooltipLookup],
  );

  // Header stats component
  const headerStats = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
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
            {(stats.max_pair_frac * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Max Pair Fraction</div>
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
        minLabel="Minimum Co-occurrence Fraction"
        maxLabel="Max"
        min={0}
        max={stats.max_pair_frac}
        step={0.001}
        showTopK={showTopK}
        setShowTopK={setShowTopK}
        topK={topK}
        setTopK={setTopK}
        topKEnabled={true}
        topKMax={stats.unique_pairs}
        topKLabel="by co-occurrence fraction"
        filteredCount={filteredData.length}
        totalCount={stats.unique_pairs}
      />
    ),
    [
      minThreshold,
      stats.max_pair_frac,
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
          <span>Low co-occurrence</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span>High co-occurrence</span>
        </div>
      </>
    ),
    [],
  );

  // Interpretation component
  const interpretation = useMemo(
    () => (
      <p>
        <strong>Interpretation:</strong> Darker colors indicate higher
        co-occurrence rates. Each cell shows how often two candidates appear
        together on the same ballot, regardless of their ranking order.
      </p>
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
          <div className="mt-1">
            {pairData ? pairData.count.toLocaleString() : 0} ballots
          </div>
          <div className="text-muted-foreground">
            {(value * 100).toFixed(1)}% of all ballots
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
      maxValue={stats.max_pair_frac}
      formatTooltip={formatTooltip}
      formatPinnedContent={formatPinnedContent}
      controls={controls}
      title="Candidate Affinity Matrix"
      description="Heatmap showing how often pairs of candidates appear together on the
        same ballot. The co-occurrence fraction represents
        the percentage of ballots where both candidates were ranked
        together, regardless of their specific ranking positions."
      headerStats={headerStats}
      legend={legend}
      interpretation={interpretation}
      formatAxisLabel={formatAxisLabel}
    />
  );
}
