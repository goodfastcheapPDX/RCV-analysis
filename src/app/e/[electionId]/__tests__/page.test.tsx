import { render } from "@testing-library/react";
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import ElectionPage from "../page";

describe("Election Page", () => {
  it("should match snapshot for valid election with test data", async () => {
    const component = await ElectionPage({
      params: Promise.resolve({ electionId: "portland-20241105-gen" }),
    });
    const { container } = render(component);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("should call notFound for invalid election", async () => {
    await expect(
      ElectionPage({
        params: Promise.resolve({ electionId: "invalid-election" }),
      }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
