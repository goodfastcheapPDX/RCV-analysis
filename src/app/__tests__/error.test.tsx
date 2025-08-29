import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ErrorPage from "../error";

describe("Error Page", () => {
  it("should match snapshot", () => {
    const mockError = new Error("Test error message");
    const mockReset = () => {};

    const { container } = render(
      <ErrorPage error={mockError} reset={mockReset} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
