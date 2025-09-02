"use client";

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CandidatesOutput } from "../ingest_cvr/index.contract";
import type {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "./index.contract";

interface StvRoundsViewProps {
  roundsData: StvRoundsOutput[];
  metaData: StvMetaOutput[];
  stats: StvRoundsStats;
  candidates?: CandidatesOutput[];
  electionId?: string;
  contestId?: string;
}

interface CandidateRoundData {
  candidate_name: string;
  rounds: {
    round: number;
    votes: number;
    status: "standing" | "elected" | "eliminated";
  }[];
}

export function StvRoundsView({
  roundsData,
  metaData,
  stats,
  candidates,
  electionId,
  contestId,
}: StvRoundsViewProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Helper to get candidate ID for linking
  const getCandidateId = (candidateName: string): string | null => {
    if (!candidates) return null;
    const candidate = candidates.find(
      (c) => c.candidate_name === candidateName,
    );
    return candidate ? candidate.candidate_id.toString() : null;
  };

  // Helper to create candidate link if possible
  const CandidateLink = ({
    name,
    className,
  }: {
    name: string;
    className?: string;
  }) => {
    const candidateId = getCandidateId(name);
    if (candidateId && electionId && contestId) {
      return (
        <Link
          href={`/e/${electionId}/c/${contestId}/cand/${candidateId}`}
          className={`hover:underline text-blue-600 hover:text-blue-800 ${className || ""}`}
        >
          {name}
        </Link>
      );
    }
    return <span className={className}>{name}</span>;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          setCurrentRound((prev) => Math.max(1, prev - 1));
          break;
        case "ArrowRight":
          event.preventDefault();
          setCurrentRound((prev) => Math.min(stats.number_of_rounds, prev + 1));
          break;
        case " ":
          event.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case "Home":
          event.preventDefault();
          setCurrentRound(1);
          break;
        case "End":
          event.preventDefault();
          setCurrentRound(stats.number_of_rounds);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [stats.number_of_rounds]);

  // Process data into candidate-centric structure
  const candidateData = processCandidateData(roundsData);
  const currentMeta = metaData.find((m) => m.round === currentRound);

  // Color palette for candidates
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#ec4899",
    "#14b8a6",
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "elected":
        return "bg-green-500";
      case "eliminated":
        return "bg-red-500";
      default:
        return "bg-blue-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "elected":
        return "Elected";
      case "eliminated":
        return "Eliminated";
      default:
        return "Standing";
    }
  };

  // Auto-play functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentRound((prev) => {
          if (prev >= stats.number_of_rounds) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, stats.number_of_rounds]);

  return (
    <div className="space-y-6">
      {/* Header with Key Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            STV Election Results
          </CardTitle>
          <CardDescription>
            Multi-round Single Transferable Vote tabulation with {stats.seats}{" "}
            seats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">
                {stats.winners.length}
              </div>
              <div className="text-sm -foreground">Winners</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">
                {stats.number_of_rounds}
              </div>
              <div className="text-sm -foreground">Rounds</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-amber-600">
                {stats.first_round_quota}
              </div>
              <div className="text-sm -foreground">Quota</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-600">
                {candidateData.length}
              </div>
              <div className="text-sm -foreground">Candidates</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm -foreground">
              <strong>Winners:</strong> {stats.winners.join(", ")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Round Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Round {currentRound} of {stats.number_of_rounds}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentRound(1)}
                className="p-1 hover:bg-muted rounded"
                title="Reset to Round 1"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentRound((prev) => Math.max(1, prev - 1))}
                disabled={currentRound === 1}
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
                  setCurrentRound((prev) =>
                    Math.min(stats.number_of_rounds, prev + 1),
                  )
                }
                disabled={currentRound === stats.number_of_rounds}
                className="p-1 hover:bg-muted rounded disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </CardTitle>
          {currentMeta && (
            <CardDescription>
              Quota: {currentMeta.quota} • Exhausted: {currentMeta.exhausted}
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
          {/* Round Timeline Visualization */}
          <div className="space-y-3">
            {candidateData.map((candidate, idx) => {
              const roundData = candidate.rounds.find(
                (r) => r.round === currentRound,
              );
              if (!roundData) return null;

              const maxVotes = Math.max(
                ...candidateData.flatMap((c) =>
                  c.rounds
                    .filter((r) => r.round === currentRound)
                    .map((r) => r.votes),
                ),
              );
              const voteWidth =
                maxVotes > 0 ? (roundData.votes / maxVotes) * 100 : 0;

              return (
                <div key={candidate.candidate_name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-3 h-3 rounded-full ${getStatusColor(roundData.status)}`}
                        title={getStatusText(roundData.status)}
                      />
                      <CandidateLink
                        name={candidate.candidate_name}
                        className="font-medium truncate"
                      />
                      <span className="text-sm -foreground">
                        ({getStatusText(roundData.status)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {roundData.votes.toLocaleString()}
                      </span>
                      <span className="text-xs -foreground w-16 text-right">
                        {roundData.votes > 0
                          ? `${(
                              (roundData.votes / (currentMeta?.quota || 1)) *
                                100
                            ).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-6 bg-muted rounded-md overflow-hidden">
                    {/* Quota line */}
                    {currentMeta && (
                      <div
                        className="absolute top-0 w-0.5 h-full bg-amber-500 z-20"
                        style={{
                          left: `${(currentMeta.quota / maxVotes) * 100}%`,
                        }}
                        title={`Quota: ${currentMeta.quota}`}
                      />
                    )}

                    {/* Vote bar */}
                    <div
                      className={`h-full transition-all duration-500 rounded-sm ${getStatusColor(roundData.status)} opacity-80`}
                      style={{
                        width: `${Math.max(voteWidth, 2)}%`,
                        backgroundColor: colors[idx % colors.length],
                      }}
                    />

                    {/* Vote count label */}
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-xs font-medium text-white drop-shadow">
                        {roundData.votes > 0
                          ? roundData.votes.toLocaleString()
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs -foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Standing</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Elected</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Eliminated</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-amber-500" />
              <span>Quota ({currentMeta?.quota})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Educational Note & Controls Help */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm -foreground space-y-2">
              <p className="font-medium">
                About Single Transferable Vote (STV):
              </p>
              <p>
                STV is a multi-winner ranked choice voting system. Candidates
                need to reach the quota to be elected. When candidates are
                elected with surplus votes, or eliminated for having too few
                votes, their votes transfer to voters' next preferences. This
                continues until all seats are filled.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm -foreground space-y-2">
              <p className="font-medium">Keyboard Controls:</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>← →</span>
                  <span>Navigate rounds</span>
                </div>
                <div className="flex justify-between">
                  <span>Space</span>
                  <span>Play/Pause</span>
                </div>
                <div className="flex justify-between">
                  <span>Home/End</span>
                  <span>First/Last round</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function processCandidateData(
  roundsData: StvRoundsOutput[],
): CandidateRoundData[] {
  const candidateMap = new Map<string, CandidateRoundData>();

  for (const round of roundsData) {
    if (!candidateMap.has(round.candidate_name)) {
      candidateMap.set(round.candidate_name, {
        candidate_name: round.candidate_name,
        rounds: [],
      });
    }

    candidateMap.get(round.candidate_name)?.rounds.push({
      round: round.round,
      votes: round.votes,
      status: round.status,
    });
  }

  // Sort candidates by their final vote total (last round)
  return Array.from(candidateMap.values()).sort((a, b) => {
    const aFinalVotes = Math.max(...a.rounds.map((r) => r.votes));
    const bFinalVotes = Math.max(...b.rounds.map((r) => r.votes));
    return bFinalVotes - aFinalVotes;
  });
}
