import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Demo from "../page";

describe("Demo Page", () => {
  it("should match snapshot", () => {
    const { container } = render(<Demo />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
