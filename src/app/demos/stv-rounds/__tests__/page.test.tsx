import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StvRoundsDemoPage from "../page";

describe("StvRoundsDemoPage", () => {
  it("should match snapshot", () => {
    const { container } = render(<StvRoundsDemoPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
