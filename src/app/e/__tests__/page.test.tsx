import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ElectionsIndexPage from "../page";

describe("Elections Index Page", () => {
  it("should match snapshot with test data", async () => {
    const component = await ElectionsIndexPage();
    const { container } = render(component);
    expect(container.firstChild).toMatchSnapshot();
  });
});
