import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../page";

describe("Home Page", () => {
  it("should match snapshot", () => {
    const { container } = render(<Home />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
