"use client";

import { ResponsiveChord } from "@nivo/chord";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import type {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "@/contracts/slices/stv_rounds/index.contract";
import type { Output as TransferMatrixOutput } from "@/contracts/slices/transfer_matrix/index.contract";

interface ChordChartViewProps {
  transferData: TransferMatrixOutput[];
  roundsData: StvRoundsOutput[];
  metaData: StvMetaOutput[];
  stats: StvRoundsStats;
  candidates?: CandidatesOutput[];
  electionId?: string;
  contestId?: string;
}

interface ChordData {
  matrix: number[][];
  keys: string[];
  candidateStocks: Record<string, number>;
  sources: Set<string>;
}

const EXHAUSTED_KEY = "EXHAUSTED";

export function ChordChartView({
  transferData,
  roundsData,
  metaData,
}: ChordChartViewProps) {
  const [currentRound, setCurrentRound] = useState(2); // Transfers start at round 2
  const [isPlaying, setIsPlaying] = useState(false);
  const [threshold, setThreshold] = useState([0.25]);
  const [showPercentage, setShowPercentage] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [useAfterTransferStock, setUseAfterTransferStock] = useState(true);

  // Get available transfer rounds
  const transferRounds = [...new Set(transferData.map((t) => t.round))].sort(
    (a, b) => a - b,
  );
  const maxRound = Math.max(...transferRounds);
  const minRound = Math.min(...transferRounds);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          setCurrentRound((prev) => Math.max(minRound, prev - 1));
          break;
        case "ArrowRight":
          event.preventDefault();
          setCurrentRound((prev) => Math.min(maxRound, prev + 1));
          break;
        case " ":
          event.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case "Home":
          event.preventDefault();
          setCurrentRound(minRound);
          break;
        case "End":
          event.preventDefault();
          setCurrentRound(maxRound);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [minRound, maxRound]);

  // Auto-play functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentRound((prev) => {
          if (prev >= maxRound) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxRound]);

  // Transform data for chord chart
  const chordData = transformToChordData(
    transferData,
    roundsData,
    metaData,
    currentRound,
    threshold[0],
    showAllCandidates,
    useAfterTransferStock,
  );

  const currentMeta = metaData.find((m) => m.round === currentRound);
  const totalTransfers = transferData
    .filter((t) => t.round === currentRound)
    .reduce((sum, t) => sum + t.vote_count, 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Round {currentRound} of {maxRound}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentRound(minRound)}
                className="p-1 hover:bg-muted rounded"
                title="Reset to First Transfer Round"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentRound((prev) => Math.max(minRound, prev - 1))
                }
                disabled={currentRound === minRound}
                className="p-1 hover:bg-muted rounded disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 hover:bg-muted rounded"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentRound((prev) => Math.min(maxRound, prev + 1))
                }
                disabled={currentRound === maxRound}
                className="p-1 hover:bg-muted rounded disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </CardTitle>
          {currentMeta && (
            <CardDescription>
              Quota: {currentMeta.quota} • Exhausted: {currentMeta.exhausted} •
              Total Transfers: {totalTransfers.toLocaleString()}
              {currentMeta.elected_this_round?.length ? (
                <> • Elected: {currentMeta.elected_this_round.join(", ")}</>
              ) : null}
              {currentMeta.eliminated_this_round?.length ? (
                <>
                  {" "}
                  • Eliminated: {currentMeta.eliminated_this_round.join(", ")}
                </>
              ) : null}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Threshold Control */}
            <div className="space-y-2">
              <Label htmlFor="threshold">
                Min Flow Threshold ({threshold[0]}%)
              </Label>
              <Slider
                id="threshold"
                value={threshold}
                onValueChange={setThreshold}
                max={5}
                min={0}
                step={0.25}
                className="w-full"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="percentage"
                  checked={showPercentage}
                  onCheckedChange={setShowPercentage}
                />
                <Label htmlFor="percentage">Show Percentages</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="all-candidates"
                  checked={showAllCandidates}
                  onCheckedChange={setShowAllCandidates}
                />
                <Label htmlFor="all-candidates">Show All Candidates</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="after-transfer"
                  checked={useAfterTransferStock}
                  onCheckedChange={setUseAfterTransferStock}
                />
                <Label htmlFor="after-transfer">After-Transfer Stock</Label>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                <div>Candidates: {chordData.keys.length - 1}</div>
                <div>
                  Transfers:{" "}
                  {chordData.matrix.flat().filter((v) => v > 0).length}
                </div>
                <div>Mode: {showAllCandidates ? "All" : "Active Only"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chord Chart */}
      <Card>
        <CardContent className="pt-6">
          <div className="h-screen w-full">
            {chordData.keys.length > 1 ? (
              <ResponsiveChord
                data={chordData.matrix}
                keys={chordData.keys}
                margin={{ top: 60, right: 60, bottom: 90, left: 60 }}
                padAngle={0.02}
                innerRadiusRatio={0.96}
                innerRadiusOffset={0.02}
                arcOpacity={1}
                arcBorderWidth={1}
                arcBorderColor={{ from: "color", modifiers: [["darker", 0.4]] }}
                ribbonBorderWidth={1}
                ribbonBorderColor={{
                  from: "color",
                  modifiers: [["darker", 0.4]],
                }}
                motionConfig="gentle"
                enableLabel={true}
                label="id"
                labelOffset={12}
                labelRotation={-90}
                labelTextColor={{ from: "color", modifiers: [["darker", 1]] }}
                colors={{ scheme: "category10" }}
                isInteractive={true}
                ribbonOpacity={0.85}
                activeRibbonOpacity={0.85}
                inactiveRibbonOpacity={0.85}
                arcTooltip={({ arc }) => (
                  <strong style={{ color: arc.color }}>
                    {arc.id}:{" "}
                    {chordData.candidateStocks[
                      arc.id as string
                    ]?.toLocaleString() || 0}{" "}
                    votes
                  </strong>
                )}
                ribbonTooltip={({ ribbon }: { ribbon: any }) => {
                  // Don't show tooltips for self-ribbons
                  if (ribbon.source.index === ribbon.target.index) return null;
                  return (
                    <span style={{ color: ribbon.source.color }}>
                      <strong>{ribbon.source.id}</strong> →{" "}
                      <strong>{ribbon.target.id}</strong>:{" "}
                      {ribbon.source.value.toLocaleString()} votes
                    </span>
                  );
                }}
                legends={[
                  {
                    anchor: "bottom",
                    direction: "row",
                    translateY: 70,
                    itemWidth: 80,
                    itemHeight: 14,
                    itemsSpacing: 0,
                    itemTextColor: "#999",
                    itemDirection: "left-to-right",
                    symbolSize: 12,
                    symbolShape: "circle",
                  },
                ]}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No transfer data available for round {currentRound} with current
                threshold
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Round Summary */}
      {currentMeta && (
        <Card>
          <CardHeader>
            <CardTitle>Round {currentRound} Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold">{currentMeta.quota}</div>
                <div className="text-sm text-muted-foreground">Quota</div>
              </div>
              <div>
                <div className="text-lg font-bold">{currentMeta.exhausted}</div>
                <div className="text-sm text-muted-foreground">Exhausted</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {totalTransfers.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Transfers
                </div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {chordData.keys.length - 1}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Candidates
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">How to read the chord chart:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Arc thickness represents candidate's current vote total</li>
              <li>Ribbons show vote transfers between candidates</li>
              <li>Hover over arcs and ribbons for detailed information</li>
              <li>Use threshold slider to hide small transfers</li>
              <li>Toggle between all candidates or active-only view</li>
            </ul>
            <div className="mt-4 space-y-1">
              <p className="font-medium">Keyboard shortcuts:</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <span>← → Navigate rounds</span>
                <span>Space Play/Pause</span>
                <span>Home/End First/Last round</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function transformToChordData(
  transferData: TransferMatrixOutput[],
  roundsData: StvRoundsOutput[],
  metaData: StvMetaOutput[],
  round: number,
  thresholdPercent: number,
  showAllCandidates: boolean,
  useAfterTransferStock: boolean,
): ChordData {
  // Get transfers for the current round
  const roundTransfers = transferData.filter((t) => t.round === round);

  if (roundTransfers.length === 0) {
    return { matrix: [], keys: [], candidateStocks: {}, sources: new Set() };
  }

  // Get stock data for before and after transfer
  const beforeTransferData = roundsData.filter((r) => r.round === round - 1);
  const afterTransferData = roundsData.filter((r) => r.round === round);
  const currentMeta = metaData.find((m) => m.round === round);
  const prevMeta = metaData.find((m) => m.round === round - 1);

  // Choose stock timing
  const stockData = useAfterTransferStock
    ? afterTransferData
    : beforeTransferData;
  const candidateStocks: Record<string, number> = {};

  for (const candidate of stockData) {
    candidateStocks[candidate.candidate_name] = candidate.votes;
  }

  // Set exhausted stock based on timing choice
  candidateStocks[EXHAUSTED_KEY] = useAfterTransferStock
    ? currentMeta?.exhausted || 0
    : prevMeta?.exhausted || 0;

  // Determine which candidates to include
  let candidates: string[];
  if (showAllCandidates) {
    // All candidates from any round
    candidates = [...new Set(roundsData.map((r) => r.candidate_name))].sort();
  } else {
    // Only candidates who are still "alive" (not eliminated) in the current round + those involved in transfers
    const activeCandidates = new Set(
      afterTransferData
        .filter((r) => r.status !== "eliminated") // Exclude eliminated candidates
        .map((r) => r.candidate_name),
    );
    const transferCandidates = new Set([
      ...roundTransfers.map((t) => t.from_candidate_name),
      ...roundTransfers
        .map((t) => t.to_candidate_name)
        .filter((name) => name !== null),
    ]);

    candidates = [
      ...new Set([...activeCandidates, ...transferCandidates]),
    ].sort();
  }

  // Add exhausted placeholder
  const keys = [...candidates, EXHAUSTED_KEY];

  // Calculate threshold value
  const totalTransfers = roundTransfers.reduce(
    (sum, t) => sum + t.vote_count,
    0,
  );
  const thresholdValue = (totalTransfers * thresholdPercent) / 100;

  // Create index mapping
  const keyToIndex = new Map(keys.map((k, i) => [k, i]));
  const n = keys.length;

  // Initialize matrix and outgoing totals
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const outgoingTotals = Array(n).fill(0);

  // Fill off-diagonals with transfers (above threshold)
  for (const transfer of roundTransfers) {
    if (transfer.vote_count < thresholdValue) continue;

    const fromIndex = keyToIndex.get(transfer.from_candidate_name);
    const toIndex = transfer.to_candidate_name
      ? keyToIndex.get(transfer.to_candidate_name)
      : keyToIndex.get(EXHAUSTED_KEY);

    if (fromIndex != null && toIndex != null && fromIndex !== toIndex) {
      matrix[fromIndex][toIndex] = transfer.vote_count;
      outgoingTotals[fromIndex] += transfer.vote_count;
    }
  }

  // Set diagonals to make row sum = stock (arc size = stock)
  const epsilon = 1e-6;
  for (const key of keys) {
    const i = keyToIndex.get(key)!;
    const stock = Math.max(0, candidateStocks[key] || 0);
    const diagonal = Math.max(epsilon, stock - outgoingTotals[i]);
    matrix[i][i] = diagonal;
  }

  // Identify sources (candidates with outgoing transfers this round)
  const sources = new Set<string>();
  for (const transfer of roundTransfers) {
    sources.add(transfer.from_candidate_name);
  }

  return { matrix, keys, candidateStocks, sources };
}
