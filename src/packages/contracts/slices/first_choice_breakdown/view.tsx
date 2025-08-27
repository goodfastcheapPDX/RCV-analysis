"use client";

import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Output } from "./index.contract";

interface FirstChoiceBreakdownViewProps {
  data: Output[];
}

export function FirstChoiceBreakdownView({
  data,
}: FirstChoiceBreakdownViewProps) {
  // Sort data by first_choice_votes in descending order
  const sortedData = [...data].sort(
    (a, b) => b.first_choice_votes - a.first_choice_votes,
  );

  // Dynamic chart colors based on number of candidates
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  // Create chart config and data with individual colors for each candidate
  const chartConfig: ChartConfig = {
    first_choice_votes: {
      label: "Votes",
    },
  } satisfies ChartConfig;

  // Add each candidate to the config with their own color
  sortedData.forEach((item, index) => {
    const candidateKey = item.candidate_name.toLowerCase().replace(/\s+/g, "_");
    chartConfig[candidateKey] = {
      label: item.candidate_name,
      color: colors[index % colors.length],
    };
  });

  // Format data for horizontal bar chart
  const chartData = sortedData.map((item, index) => {
    const _candidateKey = item.candidate_name
      .toLowerCase()
      .replace(/\s+/g, "_");
    return {
      candidate:
        item.candidate_name.length > 35
          ? `${item.candidate_name.slice(0, 35)}...`
          : item.candidate_name,
      fullName: item.candidate_name,
      first_choice_votes: item.first_choice_votes,
      pct: item.pct,
      fill: colors[index % colors.length],
    };
  });

  const totalVotes = sortedData.reduce(
    (sum, item) => sum + item.first_choice_votes,
    0,
  );
  const topCandidate = sortedData[0];
  const leadPercentage =
    sortedData.length > 1
      ? (((topCandidate?.first_choice_votes || 0) -
          (sortedData[1]?.first_choice_votes || 0)) /
          (totalVotes || 1)) *
        100
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>First Choice Breakdown</CardTitle>
        <CardDescription>
          Candidate preferences in first round ({totalVotes.toLocaleString()}{" "}
          total ballots)
        </CardDescription>
        <div className="text-sm text-muted-foreground mt-2 p-3 bg-muted/50 rounded-lg">
          <p className="font-medium mb-1">About this chart:</p>
          <p>
            This shows how many voters selected each candidate as their first
            choice. In ranked-choice voting, this is just the starting point -
            votes may transfer to other candidates during tabulation rounds.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{
                left: 0,
                right: 120,
              }}
            >
              <YAxis
                dataKey="candidate"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                className="text-xs"
                width={160}
              />
              <XAxis dataKey="first_choice_votes" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, props) => [
                      <div key="tooltip" className="flex flex-col gap-1">
                        <div className="font-medium text-foreground">
                          {props.payload?.fullName}
                        </div>
                        <div className="text-sm text-foreground/80 font-medium">
                          {value.toLocaleString()} votes (
                          {props.payload?.pct.toFixed(1)}%)
                        </div>
                      </div>,
                    ]}
                  />
                }
              />
              <Bar dataKey="first_choice_votes" layout="vertical" radius={4}>
                <LabelList
                  dataKey="first_choice_votes"
                  position="right"
                  offset={8}
                  className="text-xs font-medium fill-foreground"
                  formatter={(value: number) => value.toLocaleString()}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      {topCandidate && (
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            {topCandidate.candidate_name} leads with{" "}
            {topCandidate.pct.toFixed(1)}%
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground leading-none">
            {leadPercentage > 0 &&
              sortedData.length > 1 &&
              `${leadPercentage.toFixed(1)} percentage point lead over second place`}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
