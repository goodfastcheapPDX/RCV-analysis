"use client";

import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import { ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Output as TransferMatrixOutput } from "@/contracts/slices/transfer_matrix/index.contract";
import {
  calculateLinkPath,
  getTransferReasonColor,
  getTransferReasonOpacity,
  type SankeyLink,
  type SankeyNode,
  transformTransferMatrixToSankey,
} from "@/lib/sankey-transform";

interface SankeyTransferDiagramProps {
  data: TransferMatrixOutput[];
  contestName: string;
}

// TODO: Re-enable tooltip interface when implementing accessibility
// interface TooltipInfo { ... }

export function SankeyTransferDiagram({
  data,
  contestName,
}: SankeyTransferDiagramProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [minTransferPct, setMinTransferPct] = useState(0.25);

  const sankeyData = useMemo(() => {
    if (data.length === 0) return null;

    // Filter out small transfers based on percentage threshold
    const totalVotes = data.reduce((sum, d) => sum + d.vote_count, 0);
    const filteredData = data.filter(
      (d) => (d.vote_count / totalVotes) * 100 >= minTransferPct,
    );

    return transformTransferMatrixToSankey(filteredData, {
      width: 800,
      height: 500,
      nodeWidth: 15,
      padding: 60,
    });
  }, [data, minTransferPct]);

  const formatVotes = (count: number) => {
    return count.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  // Abbreviate candidate names
  const abbreviateName = (name: string): string => {
    if (name === "EXHAUSTED" || name === "Exhausted Votes") return "Exhausted";
    if (name.startsWith("Write-in") || name.includes("Write In")) return name;

    const parts = name.split(" ");
    if (parts.length >= 2) {
      return parts[parts.length - 1]; // Return last name
    }
    return name.length > 12 ? `${name.substring(0, 9)}...` : name;
  };

  // Check if a link should be highlighted based on selected candidate
  const shouldHighlightLink = (link: SankeyLink): boolean => {
    if (!selectedCandidateId) return true;
    return (
      link.source === selectedCandidateId || link.target === selectedCandidateId
    );
  };

  // Handle candidate selection
  const handleCandidateClick = (candidateId: string) => {
    setSelectedCandidateId(
      selectedCandidateId === candidateId ? null : candidateId,
    );
  };

  // TODO: Re-enable interactive tooltips after fixing accessibility issues
  // const handleMouseEnter = (...) => { ... }
  // const handleMouseLeave = () => { ... }

  if (!sankeyData || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Transfer Flow Diagram</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Sankey diagram showing the flow of votes between
                      candidates across all elimination rounds in the STV
                      process.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant="outline" className="text-xs">
              transfer_matrix
            </Badge>
          </div>
          <CardDescription>
            Vote transfer flows for {contestName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[400px] flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <div className="text-center space-y-4 p-8">
              <div className="text-lg font-semibold text-muted-foreground">
                No Transfer Data
              </div>
              <div className="text-sm text-muted-foreground max-w-md">
                No vote transfers occurred in this contest, or transfer data is
                not yet available.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxLinkValue = Math.max(...sankeyData.links.map((link) => link.value));
  const rounds = Array.from(new Set(data.map((d) => d.round))).sort(
    (a, b) => a - b,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Transfer Flow Diagram</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Sankey diagram showing the flow of votes between candidates
                    across all elimination rounds in the STV process. Line
                    thickness represents vote volume.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className="text-xs">
            transfer_matrix
          </Badge>
        </div>
        <CardDescription>
          Vote transfer flows for {contestName} (
          {formatVotes(sankeyData.totalVotes)} total votes transferred across{" "}
          {rounds.length} rounds)
          {selectedCandidateId && (
            <span className="block mt-1 text-sm font-medium text-primary">
              Focusing on: {selectedCandidateId}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-2 rounded-sm"
                    style={{
                      backgroundColor: getTransferReasonColor("elimination"),
                      opacity: getTransferReasonOpacity("elimination"),
                    }}
                  />
                  <span>Elimination transfers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-2 rounded-sm"
                    style={{
                      backgroundColor: getTransferReasonColor("surplus"),
                      opacity: getTransferReasonOpacity("surplus"),
                    }}
                  />
                  <span>Surplus transfers</span>
                </div>
              </div>

              {selectedCandidateId && (
                <button
                  type="button"
                  onClick={() => setSelectedCandidateId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* Threshold slider */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground min-w-fit">
                Min transfer: {minTransferPct.toFixed(2)}%
              </span>
              <Slider
                value={[minTransferPct]}
                onValueChange={(value) => setMinTransferPct(value[0])}
                max={2.0}
                min={0.05}
                step={0.05}
                className="flex-1 max-w-[200px]"
              />
            </div>
          </div>

          {/* Sankey Diagram */}
          <div className="w-full h-[500px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <svg
                viewBox="0 0 800 500"
                className="w-full h-full"
                role="img"
                aria-label="Sankey diagram showing vote transfer flows between candidates"
              >
                <defs>
                  <clipPath id="main-area">
                    <rect x="60" y="40" width="680" height="420" />
                  </clipPath>
                </defs>

                {/* Round banding */}
                {rounds
                  .slice(0, Math.min(rounds.length, 12))
                  .map((round, index) => {
                    const x =
                      60 +
                      index *
                        ((800 - 120) /
                          Math.max(Math.min(rounds.length, 12) - 1, 1));
                    const width =
                      (800 - 120) /
                      Math.max(Math.min(rounds.length, 12) - 1, 1);
                    return (
                      <rect
                        key={`band-${round}`}
                        x={x - width / 2}
                        y={0}
                        width={width}
                        height={500}
                        fill="currentColor"
                        opacity={index % 2 === 0 ? 0.02 : 0.04}
                      />
                    );
                  })}

                {/* Round headers */}
                {rounds
                  .slice(0, Math.min(rounds.length, 12))
                  .map((round, index) => {
                    const x =
                      60 +
                      index *
                        ((800 - 120) /
                          Math.max(Math.min(rounds.length, 12) - 1, 1));
                    return (
                      <text
                        key={`header-${round}`}
                        x={x}
                        y={25}
                        textAnchor="middle"
                        className="fill-current text-xs font-medium text-muted-foreground"
                        clipPath="url(#main-area)"
                      >
                        R{round}
                      </text>
                    );
                  })}

                {/* Links (flows) */}
                <g clipPath="url(#main-area)">
                  {sankeyData.links.map((link, index) => {
                    const sourceNode = sankeyData.nodes.find(
                      (n) => n.id === link.source,
                    );
                    const targetNode = sankeyData.nodes.find(
                      (n) => n.id === link.target,
                    );

                    if (!sourceNode || !targetNode) return null;

                    const isHighlighted = shouldHighlightLink(link);
                    const opacity = selectedCandidateId
                      ? isHighlighted
                        ? 0.9
                        : 0.08
                      : getTransferReasonOpacity(link.reason);

                    return (
                      <path
                        key={`${link.source}-${link.target}-${index}`}
                        d={calculateLinkPath(
                          sourceNode,
                          targetNode,
                          link.value,
                          maxLinkValue,
                        )}
                        fill={getTransferReasonColor(link.reason)}
                        fillOpacity={opacity}
                        stroke="none"
                        className="transition-opacity duration-200"
                        aria-label={`Transfer from ${link.source} to ${link.target} in round ${link.round}`}
                      />
                    );
                  })}
                </g>

                {/* Nodes */}
                {sankeyData.nodes.map((node) => {
                  const isSelected = selectedCandidateId === node.id;
                  const isExhausted = node.type === "exhausted";
                  const abbreviatedName = abbreviateName(node.name);

                  return (
                    <g key={node.id}>
                      <rect
                        x={node.x}
                        y={node.y - 20}
                        width={15}
                        height={40}
                        fill={
                          isExhausted
                            ? "#6b7280"
                            : isSelected
                              ? "#3b82f6"
                              : "#1f2937"
                        }
                        stroke={isSelected ? "#1d4ed8" : "none"}
                        strokeWidth={isSelected ? 2 : 0}
                        className="cursor-pointer transition-colors duration-200"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCandidateClick(node.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCandidateClick(node.id)
                        }
                        aria-label={`Candidate ${node.name}${node.round ? ` eliminated in round ${node.round}` : ""}`}
                      />

                      {/* Node labels */}
                      <text
                        x={node.x + (isExhausted ? 8 : -5)}
                        y={node.y - 25}
                        textAnchor={isExhausted ? "middle" : "end"}
                        className={`fill-current text-xs cursor-pointer transition-colors duration-200 ${
                          isSelected
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                        style={{ fontSize: "10px" }}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCandidateClick(node.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCandidateClick(node.id)
                        }
                      >
                        {abbreviatedName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </ResponsiveContainer>

            {/* TODO: Re-enable custom tooltip after fixing accessibility */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
