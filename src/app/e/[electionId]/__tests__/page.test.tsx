import { render } from "@testing-library/react";
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import ElectionPage from "../page";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock the environment to use test data
vi.mock("@/lib/env", () => ({
  getDataEnv: () => "test",
}));

describe("Election Page", () => {
  it("should match snapshot for valid election with test data", async () => {
    const component = await ElectionPage({
      params: Promise.resolve({ electionId: "portland-20241105-gen" }),
    });
    const { container } = render(component);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("should call notFound for invalid election", async () => {
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("Not Found");
    });

    await expect(
      ElectionPage({
        params: Promise.resolve({ electionId: "invalid-election" }),
      }),
    ).rejects.toThrow("Not Found");

    expect(notFound).toHaveBeenCalled();
  });
});
