import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FirstChoiceDemoPage from "../page";

describe("FirstChoiceDemoPage", () => {
  it("should match snapshot", () => {
    const { container } = render(<FirstChoiceDemoPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
