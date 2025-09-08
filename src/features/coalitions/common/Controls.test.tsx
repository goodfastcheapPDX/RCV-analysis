import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Controls } from "./Controls";

const mockProps = {
  minThreshold: [0.1],
  setMinThreshold: vi.fn(),
  minLabel: "Min",
  maxLabel: "Max",
  min: 0,
  max: 1,
  step: 0.01,
  showTopK: false,
  setShowTopK: vi.fn(),
  topK: [100],
  setTopK: vi.fn(),
  topKEnabled: false,
  topKMax: 500,
  topKLabel: "test",
  filteredCount: 10,
  totalCount: 50,
};

describe("Controls", () => {
  it("renders without crashing", () => {
    const { container } = render(<Controls {...mockProps} />);
    expect(container).toBeTruthy();
  });
});
