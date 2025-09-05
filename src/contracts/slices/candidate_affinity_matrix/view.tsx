"use client";

import { ResponsiveHeatMap, TooltipComponent } from "@nivo/heatmap";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { CandidatesOutput } from "../ingest_cvr/index.contract";
import type {
  Output as CandidateAffinityMatrixOutput,
  Stats as CandidateAffinityStats,
} from "./index.contract";

interface CandidateAffinityMatrixViewProps {
  affinityData: CandidateAffinityMatrixOutput[];
  stats: CandidateAffinityStats;
  candidates?: CandidatesOutput[];
  electionId?: string;
  contestId?: string;
}

interface HeatmapData {
  id: string;
  data: Array<{
    x: string;
    y: number;
  }>;
}

export function CandidateAffinityMatrixView({
  affinityData,
  stats,
  candidates,
}: CandidateAffinityMatrixViewProps) {
  const [minThreshold, setMinThreshold] = useState<number[]>([0]);
  const [showTopK, setShowTopK] = useState(false);
  const [topK, setTopK] = useState<number[]>([100]);

  // Helper to get candidate name from candidate_id
  const getCandidateName = (candidateId: number): string => {
    if (!candidates) return candidateId.toString();
    const candidate = candidates.find((c) => c.candidate_id === candidateId);
    return candidate ? candidate.candidate_name : candidateId.toString();
  };

  // Helper to get last name only from candidate name
  const getLastName = (candidateId: number): string => {
    const fullName = getCandidateName(candidateId);
    const nameParts = fullName.split(" ");
    return nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;
  };

  // Get all unique candidates and sort by first-choice vote totals (descending)
  const allCandidates = Array.from(
    new Set([
      ...affinityData.map((d) => d.candidate_a),
      ...affinityData.map((d) => d.candidate_b),
    ]),
  );

  // Sort candidates by first-choice totals if available, otherwise by ID
  const sortedCandidates = allCandidates.sort((a, b) => {
    if (candidates) {
      const candidateA = candidates.find((c) => c.candidate_id === a);
      const candidateB = candidates.find((c) => c.candidate_id === b);

      // If both have candidate data, sort by name (stable and interpretable)
      if (candidateA && candidateB) {
        return candidateA.candidate_name.localeCompare(
          candidateB.candidate_name,
        );
      }
    }
    return a - b; // Numeric sort for candidate IDs
  });

  // Apply filters
  let filteredData = affinityData.filter(
    (d) => d.cooccurrence_frac >= minThreshold[0],
  );

  if (showTopK) {
    filteredData = filteredData
      .sort((a, b) => b.cooccurrence_frac - a.cooccurrence_frac)
      .slice(0, topK[0]);
  }

  // Transform data into heatmap format
  // Create symmetric matrix where M[a,b] = M[b,a]
  const heatmapData: HeatmapData[] = [];

  // Initialize with all candidates
  for (const candidateA of sortedCandidates) {
    const rowData: Array<{ x: string; y: number }> = [];

    for (const candidateB of sortedCandidates) {
      if (candidateA === candidateB) {
        // Self-pairs are excluded - show as 0
        rowData.push({
          x: candidateB.toString(),
          y: 0,
        });
      } else {
        // Find the canonical pair (a < b lexicographically)
        const canonicalA = candidateA < candidateB ? candidateA : candidateB;
        const canonicalB = candidateA < candidateB ? candidateB : candidateA;

        const pair = filteredData.find(
          (d) => d.candidate_a === canonicalA && d.candidate_b === canonicalB,
        );

        rowData.push({
          x: candidateB.toString(),
          y: pair ? pair.cooccurrence_frac : 0,
        });
      }
    }

    heatmapData.push({
      id: candidateA.toString(),
      data: rowData,
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: nivo heatmap props
  const formatTooltip = (props: any) => {
    const { cell } = props;
    const candidateAId = parseInt(cell.serieId); // Row candidate (y-axis)
    const candidateBId = parseInt(cell.data.x); // Column candidate (x-axis)
    const value = cell.value;

    // Direct lookup using candidate IDs
    const candidateAName = getCandidateName(candidateAId);
    const candidateBName = getCandidateName(candidateBId);

    if (candidateAId === candidateBId) {
      // Self-pairs - just show the candidate name
      return (
        <div className="bg-background border rounded p-2 shadow-lg text-sm">
          <strong>{candidateAName}</strong>
        </div>
      );
    }

    // Find the actual pair data for ballot count
    const canonicalAId = candidateAId < candidateBId ? candidateAId : candidateBId;
    const canonicalBId = candidateAId < candidateBId ? candidateBId : candidateAId;
    
    const pair = affinityData.find(
      (d) => d.candidate_a === canonicalAId && d.candidate_b === canonicalBId,
    );

    return (
      <div className="bg-background border rounded p-2 shadow-lg text-sm">
        <div className="font-semibold">
          {candidateAName} ↔ {candidateBName}
        </div>
        <div className="mt-1">
          {pair ? pair.cooccurrence_count.toLocaleString() : 0} ballots
        </div>
        <div className="text-muted-foreground">
          {(value * 100).toFixed(1)}% of all ballots
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Key Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Candidate Affinity Matrix</CardTitle>
          <CardDescription>
            Heatmap showing how often pairs of candidates appear together on the
            same ballot. The <strong>co-occurrence fraction</strong> represents the 
            percentage of ballots where both candidates were ranked together, 
            regardless of their specific ranking positions.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="text-sm text-muted-foreground">
                Max Pair Fraction
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Visualization Controls</CardTitle>
          <CardDescription>
            Adjust the display to focus on specific patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 max-w-lg">
            <div className="flex justify-between items-center">
              <Label htmlFor="threshold-slider">
                Minimum Co-occurrence Fraction:{" "}
                <span className="font-mono">{(minThreshold[0] * 100).toFixed(1)}%</span>
              </Label>
              <span className="text-sm text-muted-foreground">
                Max: {(stats.max_pair_frac * 100).toFixed(1)}%
              </span>
            </div>
            <Slider
              id="threshold-slider"
              min={0}
              max={stats.max_pair_frac}
              step={0.001}
              value={minThreshold}
              onValueChange={setMinThreshold}
              className="w-full"
            />
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              id="top-k-toggle"
              checked={showTopK}
              onCheckedChange={setShowTopK}
            />
            <Label htmlFor="top-k-toggle">Show only top pairs</Label>
          </div>

          {showTopK && (
            <div className="space-y-3 max-w-lg">
              <div className="flex justify-between items-center">
                <Label htmlFor="top-k-slider">
                  Top <span className="font-mono">{topK[0]}</span> pairs by co-occurrence fraction
                </Label>
                <span className="text-sm text-muted-foreground">
                  Max: {Math.min(500, stats.unique_pairs)}
                </span>
              </div>
              <Slider
                id="top-k-slider"
                min={10}
                max={Math.min(500, stats.unique_pairs)}
                step={10}
                value={topK}
                onValueChange={setTopK}
                className="w-full"
              />
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Showing {filteredData.length} of {stats.unique_pairs} pairs
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardContent className="pt-6">
          <div className="h-[600px] w-full p-8">
            <ResponsiveHeatMap
              data={heatmapData}
              margin={{ top: 80, right: 80, bottom: 60, left: 160 }}
              valueFormat=" >-.3%"
              axisTop={{
                tickSize: 5,
                tickPadding: 8,
                tickRotation: -45,
                legend: "",
                legendOffset: 46,
                truncateTickAt: 0,
                format: (candidateId: string) => getLastName(parseInt(candidateId)),
              }}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 8,
                tickRotation: 45,
                legend: "",
                legendPosition: "middle",
                legendOffset: 0,
                truncateTickAt: 0,
                format: (candidateId: string) => getLastName(parseInt(candidateId)),
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 8,
                tickRotation: 0,
                legend: "",
                legendPosition: "middle",
                legendOffset: 0,
                truncateTickAt: 0,
                format: (candidateId: string) => getLastName(parseInt(candidateId)),
              }}
              colors={{
                type: "diverging",
                scheme: "blue_green",
                divergeAt: 0.5,
                minValue: 0,
                maxValue: stats.max_pair_frac,
              }}
              emptyColor="#f8f9fa"
              enableLabels={sortedCandidates.length <= 12}
              labelTextColor={{
                from: "color",
                modifiers: [["darker", 1.8]],
              }}
              tooltip={formatTooltip}
              animate={true}
              motionConfig="gentle"
            />
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
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
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              <strong>Interpretation:</strong> Darker colors indicate higher
              co-occurrence rates. Each cell shows how often two candidates
              appear together on the same ballot, regardless of their ranking
              order.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
