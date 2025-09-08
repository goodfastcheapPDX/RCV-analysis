import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoalitionHeatmapBase } from "./CoalitionHeatmapBase";

const mockProps = {
  rows: ["1"],
  cols: ["1"],
  values: { "1-1": 0 },
  maxValue: 1.0,
  formatTooltip: () => <div>Tooltip</div>,
  controls: <div>Controls</div>,
  title: "Test",
  description: "Description",
  headerStats: <div>Stats</div>,
};

describe("CoalitionHeatmapBase", () => {
  it("renders without crashing", () => {
    const { container } = render(<CoalitionHeatmapBase {...mockProps} />);
    expect(container).toBeTruthy();
  });
});
