"use client";

import { ResponsiveHeatMap } from "@nivo/heatmap";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface HeatmapData {
  id: string;
  data: Array<{
    x: string;
    y: number;
  }>;
}

interface PinnedTooltip {
  candidateAId: number;
  candidateBId: number;
  value: number;
  x: number;
  y: number;
}

interface CoalitionHeatmapBaseProps {
  rows: string[];
  cols: string[];
  values: Record<string, number>;
  maxValue: number;
  formatTooltip: (rowId: string, colId: string, value: number) => ReactNode;
  formatPinnedContent?: (
    rowId: string,
    colId: string,
    value: number,
  ) => ReactNode;
  controls: ReactNode;
  onCellClick?: (rowId: string, colId: string) => void;
  title: string;
  description: string;
  headerStats: ReactNode;
  legend?: ReactNode;
  interpretation?: ReactNode;
  formatAxisLabel?: (candidateId: string) => string;
}

export function CoalitionHeatmapBase({
  rows,
  cols,
  values,
  maxValue,
  formatTooltip,
  formatPinnedContent,
  controls,
  onCellClick,
  title,
  description,
  headerStats,
  legend,
  interpretation,
  formatAxisLabel,
}: CoalitionHeatmapBaseProps) {
  const [pinnedTooltip, setPinnedTooltip] = useState<PinnedTooltip | null>(
    null,
  );

  // Transform data for Nivo heatmap format
  const heatmapData = useMemo(() => {
    const data: HeatmapData[] = [];

    for (const rowId of rows) {
      const rowData: Array<{ x: string; y: number }> = [];

      for (const colId of cols) {
        const key = `${rowId}-${colId}`;
        const value = values[key] || 0;

        rowData.push({
          x: colId,
          y: value,
        });
      }

      data.push({
        id: rowId,
        data: rowData,
      });
    }

    return data;
  }, [rows, cols, values]);

  // Handle cell click to pin tooltip
  const handleCellClick = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: nivo heatmap cell type
    (cell: any) => {
      const candidateAId = parseInt(cell.serieId, 10);
      const candidateBId = parseInt(cell.data.x, 10);

      if (onCellClick) {
        onCellClick(cell.serieId, cell.data.x);
      }

      // If clicking the same cell, unpin the tooltip
      if (
        pinnedTooltip &&
        pinnedTooltip.candidateAId === candidateAId &&
        pinnedTooltip.candidateBId === candidateBId
      ) {
        setPinnedTooltip(null);
      } else {
        // Pin the new tooltip
        setPinnedTooltip({
          candidateAId,
          candidateBId,
          value: cell.value,
          x: cell.x + cell.width / 2,
          y: cell.y + cell.height / 2,
        });
      }
    },
    [onCellClick, pinnedTooltip],
  );

  // Memoize the tooltip wrapper that uses the provided formatter
  const tooltipWrapper = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: nivo heatmap cell type
    (props: any) => {
      const { cell } = props;
      const rowId = cell.serieId;
      const colId = cell.data.x;
      const value = cell.value;
      return formatTooltip(rowId, colId, value);
    },
    [formatTooltip],
  );

  // Memoize axis configurations
  const axisConfigs = useMemo(
    () => ({
      axisTop: {
        tickSize: 5,
        tickPadding: 8,
        tickRotation: -45,
        legend: "",
        legendOffset: 46,
        truncateTickAt: 0,
        format: formatAxisLabel,
      },
      axisBottom: {
        tickSize: 5,
        tickPadding: 8,
        tickRotation: 45,
        legend: "",
        legendPosition: "middle" as const,
        legendOffset: 0,
        truncateTickAt: 0,
        format: formatAxisLabel,
      },
      axisLeft: {
        tickSize: 5,
        tickPadding: 8,
        tickRotation: 0,
        legend: "",
        legendPosition: "middle" as const,
        legendOffset: 0,
        truncateTickAt: 0,
        format: formatAxisLabel,
      },
    }),
    [formatAxisLabel],
  );

  // Memoize color configuration
  const colorConfig = useMemo(
    () => ({
      type: "diverging" as const,
      scheme: "blue_green" as const,
      divergeAt: 0.5,
      minValue: 0,
      maxValue,
    }),
    [maxValue],
  );

  return (
    <div className="space-y-6">
      {/* Header with Key Stats */}
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{headerStats}</CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Visualization Controls</CardTitle>
          <CardDescription>
            Adjust the display to focus on specific patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">{controls}</CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardContent className="pt-6 relative">
          <div className="h-[800px] w-full p-8">
            <ResponsiveHeatMap
              data={heatmapData}
              margin={{ top: 80, right: 80, bottom: 60, left: 160 }}
              valueFormat=" >-.3%"
              axisTop={axisConfigs.axisTop}
              axisRight={null}
              axisBottom={axisConfigs.axisBottom}
              axisLeft={axisConfigs.axisLeft}
              colors={colorConfig}
              emptyColor="#f8f9fa"
              enableLabels={rows.length <= 12}
              labelTextColor={{
                from: "color" as const,
                modifiers: [["darker", 1.8]] as const,
              }}
              tooltip={tooltipWrapper}
              onClick={handleCellClick}
              animate={false}
            />
          </div>

          {/* Pinned Tooltip */}
          {pinnedTooltip && (
            <div
              className="absolute bg-background border rounded p-3 shadow-lg text-sm z-10 max-w-sm"
              style={{
                left: pinnedTooltip.x - 150, // Center approximately (wider)
                top: pinnedTooltip.y + 10,
                pointerEvents: "auto",
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  {formatPinnedContent
                    ? formatPinnedContent(
                        pinnedTooltip.candidateAId.toString(),
                        pinnedTooltip.candidateBId.toString(),
                        pinnedTooltip.value,
                      )
                    : formatTooltip(
                        pinnedTooltip.candidateAId.toString(),
                        pinnedTooltip.candidateBId.toString(),
                        pinnedTooltip.value,
                      )}
                </div>
                <button
                  type="button"
                  onClick={() => setPinnedTooltip(null)}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0 -mt-1"
                  aria-label="Close tooltip"
                >
                  ×
                </button>
              </div>

              <div className="text-xs text-muted-foreground mt-3 border-t pt-2">
                Click square again to unpin
              </div>
            </div>
          )}

          {/* Legend */}
          {legend && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              {legend}
            </div>
          )}

          {/* Interpretation */}
          {interpretation && (
            <div className="mt-4 text-sm text-muted-foreground">
              {interpretation}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
