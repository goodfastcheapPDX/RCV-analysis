"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface ControlsProps {
  // Threshold controls
  minThreshold: number[];
  setMinThreshold: (value: number[]) => void;
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number;
  step: number;

  // Top K controls
  showTopK: boolean;
  setShowTopK: (value: boolean) => void;
  topK: number[];
  setTopK: (value: number[]) => void;
  topKEnabled: boolean;
  topKMax: number;
  topKLabel: string; // e.g., "by co-occurrence fraction" or "by Jaccard similarity"

  // Display info
  filteredCount: number;
  totalCount: number;
}

export function Controls({
  minThreshold,
  setMinThreshold,
  minLabel,
  maxLabel,
  min,
  max,
  step,
  showTopK,
  setShowTopK,
  topK,
  setTopK,
  topKEnabled,
  topKMax,
  topKLabel,
  filteredCount,
  totalCount,
}: ControlsProps) {
  return (
    <>
      <div className="space-y-3 max-w-lg">
        <div className="flex justify-between items-center">
          <Label htmlFor="threshold-slider">
            {minLabel}:{" "}
            <span className="font-mono">
              {(minThreshold[0] * 100).toFixed(1)}%
            </span>
          </Label>
          <span className="text-sm text-muted-foreground">
            {maxLabel}: {(max * 100).toFixed(1)}%
          </span>
        </div>
        <Slider
          id="threshold-slider"
          min={min}
          max={max}
          step={step}
          value={minThreshold}
          onValueChange={setMinThreshold}
          className="w-full [&>span[data-orientation=horizontal]]:bg-secondary"
        />
      </div>

      {topKEnabled && (
        <div className="flex items-center space-x-3">
          <Switch
            id="top-k-toggle"
            checked={showTopK}
            onCheckedChange={setShowTopK}
          />
          <Label htmlFor="top-k-toggle">Show only top pairs</Label>
        </div>
      )}

      {topKEnabled && showTopK && (
        <div className="space-y-3 max-w-lg">
          <div className="flex justify-between items-center">
            <Label htmlFor="top-k-slider">
              Top <span className="font-mono">{topK[0]}</span> pairs {topKLabel}
            </Label>
            <span className="text-sm text-muted-foreground">
              Max: {Math.min(500, topKMax)}
            </span>
          </div>
          <Slider
            id="top-k-slider"
            min={10}
            max={Math.min(500, topKMax)}
            step={10}
            value={topK}
            onValueChange={setTopK}
            className="w-full [&>span[data-orientation=horizontal]]:bg-secondary"
          />
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {filteredCount} of {totalCount} pairs
      </div>
    </>
  );
}
