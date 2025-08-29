import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "../layout";

// Mock AppShell component
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

describe("Root Layout", () => {
  it("should match snapshot", () => {
    const { container } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
