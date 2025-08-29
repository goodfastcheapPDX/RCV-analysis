import { render } from "@testing-library/react";
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import ContestPage from "../page";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock the environment to use test data
vi.mock("@/lib/env", () => ({
  getDataEnv: () => "test",
}));

describe("Contest Page", () => {
  it("should match snapshot for valid contest with test data", async () => {
    const component = await ContestPage({
      params: Promise.resolve({
        electionId: "portland-20241105-gen",
        contestId: "d2-3seat",
      }),
    });
    const { container } = render(component);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("should call notFound for invalid election", async () => {
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("Not Found");
    });

    await expect(
      ContestPage({
        params: Promise.resolve({
          electionId: "invalid-election",
          contestId: "d2-3seat",
        }),
      }),
    ).rejects.toThrow("Not Found");

    expect(notFound).toHaveBeenCalled();
  });

  it("should call notFound for invalid contest", async () => {
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("Not Found");
    });

    await expect(
      ContestPage({
        params: Promise.resolve({
          electionId: "portland-20241105-gen",
          contestId: "invalid-contest",
        }),
      }),
    ).rejects.toThrow("Not Found");

    expect(notFound).toHaveBeenCalled();
  });
});
