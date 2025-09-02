"use client";

import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Output as RankDistributionOutput } from "@/packages/contracts/slices/rank_distribution_by_candidate/index.contract";

interface RankDistributionCardProps {
  candidateName: string;
  data: RankDistributionOutput[];
}

type MetricType = "pct_all_ballots" | "pct_among_rankers";

export function RankDistributionCard({
  candidateName,
  data,
}: RankDistributionCardProps) {
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("pct_all_ballots");

  // Check if candidate has any ranking data
  const hasRankers = useMemo(() => {
    return data.some((row) => row.count > 0);
  }, [data]);

  // Prepare chart data with percentage formatting
  const chartData = useMemo(() => {
    return data.map((row) => {
      const value =
        selectedMetric === "pct_all_ballots"
          ? row.pct_all_ballots
          : row.pct_among_rankers;

      return {
        rank: `Rank ${row.rank_position}`,
        rank_number: row.rank_position,
        value: value * 100, // Convert to percentage for display
        count: row.count,
        pct_all_ballots: row.pct_all_ballots * 100,
        pct_among_rankers: row.pct_among_rankers * 100,
        fill: "#3b82f6", // blue-500
      };
    });
  }, [data, selectedMetric]);

  // Chart configuration
  const chartConfig: ChartConfig = {
    value: {
      label:
        selectedMetric === "pct_all_ballots"
          ? "% of All Ballots"
          : "% Among Rankers",
    },
  } satisfies ChartConfig;

  // Empty state (zero-rank candidate)
  if (!hasRankers) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Rank Distribution</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Shows how voters ranked this candidate across all ballot
                      positions. Helps identify whether voters saw this
                      candidate as a first choice, backup option, or compromise
                      pick.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant="outline" className="text-xs">
              rank_distribution_by_candidate
            </Badge>
          </div>
          <CardDescription>
            Visual breakdown of ranking patterns for {candidateName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[280px] flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <div className="text-center space-y-4 p-8">
              <div className="text-lg font-semibold text-muted-foreground">
                No Ranking Data
              </div>
              <div className="text-sm text-muted-foreground max-w-md">
                This candidate was never ranked on any ballot.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Rank Distribution</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Shows how voters ranked this candidate across all ballot
                    positions. Helps identify whether voters saw this candidate
                    as a first choice, backup option, or compromise pick.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className="text-xs">
            rank_distribution_by_candidate
          </Badge>
        </div>
        <CardDescription>
          Visual breakdown of ranking patterns for {candidateName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle for metric selection */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <Toggle
            pressed={selectedMetric === "pct_all_ballots"}
            onPressedChange={() => setSelectedMetric("pct_all_ballots")}
            variant="outline"
            size="sm"
            className="data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            % of All Ballots
          </Toggle>
          <Toggle
            pressed={selectedMetric === "pct_among_rankers"}
            onPressedChange={() => setSelectedMetric("pct_among_rankers")}
            variant="outline"
            size="sm"
            className="data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            % Among Rankers
          </Toggle>
        </div>

        {/* Chart */}
        <div className="min-h-[280px] md:min-h-[280px] mobile:min-h-[220px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{
                  left: 0,
                  right: 60,
                  top: 10,
                  bottom: 10,
                }}
              >
                <YAxis
                  dataKey="rank"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  className="text-xs"
                  width={60}
                />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  className="text-xs"
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(_value, _name, props) => [
                        <div key="tooltip" className="flex flex-col gap-1">
                          <div className="font-medium text-foreground">
                            Rank {props.payload?.rank_number}
                          </div>
                          <div className="text-sm text-foreground/80">
                            {props.payload?.count.toLocaleString()} votes
                          </div>
                          <div className="text-sm text-foreground/80">
                            {props.payload?.pct_all_ballots.toFixed(1)}% of all
                            ballots
                          </div>
                          <div className="text-sm text-foreground/80">
                            {props.payload?.pct_among_rankers.toFixed(1)}% among
                            rankers
                          </div>
                        </div>,
                      ]}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  layout="vertical"
                  radius={[0, 4, 4, 0]}
                  fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Live region for accessibility */}
        <div className="sr-only" aria-live="polite">
          Current metric:{" "}
          {selectedMetric === "pct_all_ballots"
            ? "Percentage of all ballots"
            : "Percentage among rankers"}
        </div>
      </CardContent>
    </Card>
  );
}
