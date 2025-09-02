"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

type MetricType =
  | "pct_all_ballots"
  | "pct_among_rankers"
  | "pct_among_position_rankers";

const formSchema = z.object({
  metric: z.enum([
    "pct_all_ballots",
    "pct_among_rankers",
    "pct_among_position_rankers",
  ]),
});

export function RankDistributionCard({
  candidateName,
  data,
}: RankDistributionCardProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      metric: "pct_all_ballots",
    },
  });

  const selectedMetric = form.watch("metric");

  // Check if candidate has any ranking data
  const hasRankers = useMemo(() => {
    return data.some((row) => row.count > 0);
  }, [data]);

  // Prepare chart data with percentage formatting
  const chartData = useMemo(() => {
    return data.map((row) => {
      let value: number;
      switch (selectedMetric) {
        case "pct_all_ballots":
          value = row.pct_all_ballots;
          break;
        case "pct_among_rankers":
          value = row.pct_among_rankers;
          break;
        case "pct_among_position_rankers":
          value = row.pct_among_position_rankers;
          break;
        default:
          value = row.pct_all_ballots;
      }

      return {
        rank: `Rank ${row.rank_position}`,
        rank_number: row.rank_position,
        value: value * 100, // Convert to percentage for display
        count: row.count,
        pct_all_ballots: row.pct_all_ballots * 100,
        pct_among_rankers: row.pct_among_rankers * 100,
        pct_among_position_rankers: row.pct_among_position_rankers * 100,
        fill: "#3b82f6", // blue-500
      };
    });
  }, [data, selectedMetric]);

  // Chart configuration
  const getMetricLabel = (metric: MetricType): string => {
    switch (metric) {
      case "pct_all_ballots":
        return "% of All Ballots";
      case "pct_among_rankers":
        return "% Among Candidate's Rankers";
      case "pct_among_position_rankers":
        return "% Among Position Rankers";
      default:
        return "% of All Ballots";
    }
  };

  const chartConfig: ChartConfig = {
    value: {
      label: getMetricLabel(selectedMetric),
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
        {/* Form with radio group for metric selection */}
        <Form {...form}>
          <FormField
            control={form.control}
            name="metric"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm font-medium">
                  Percentage Type
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="pct_all_ballots"
                        id="all-ballots"
                      />
                      <Label
                        htmlFor="all-ballots"
                        className="text-sm cursor-pointer"
                      >
                        % of All Ballots
                        <span className="block text-xs text-muted-foreground">
                          What percentage of all ballots ranked this candidate
                          at each position
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="pct_among_rankers"
                        id="candidate-rankers"
                      />
                      <Label
                        htmlFor="candidate-rankers"
                        className="text-sm cursor-pointer"
                      >
                        % Among Candidate's Rankers
                        <span className="block text-xs text-muted-foreground">
                          How this candidate's supporters distributed their
                          rankings
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="pct_among_position_rankers"
                        id="position-rankers"
                      />
                      <Label
                        htmlFor="position-rankers"
                        className="text-sm cursor-pointer"
                      >
                        % Among Position Rankers
                        <span className="block text-xs text-muted-foreground">
                          What share this candidate got of each ranking position
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
        </Form>

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
                            candidate's rankers
                          </div>
                          <div className="text-sm text-foreground/80">
                            {props.payload?.pct_among_position_rankers.toFixed(
                              1,
                            )}
                            % among position rankers
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
          Current metric: {getMetricLabel(selectedMetric)}
        </div>
      </CardContent>
    </Card>
  );
}
