import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LearnPage from "../page";

describe("Learn Page", () => {
  it("should match snapshot", () => {
    const { container } = render(<LearnPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
