import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage from "../page";

describe("About Page", () => {
  it("should match snapshot", () => {
    const { container } = render(<AboutPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
