import { describe, expect, it } from "vitest";
import { createLinkWithVersion, preserveQueryParams } from "./link-utils";

describe("preserveQueryParams", () => {
  it("should return basePath unchanged when searchParams is null", () => {
    const result = preserveQueryParams("/test", null);
    expect(result).toBe("/test");
  });

  it("should return basePath unchanged when searchParams is undefined", () => {
    const result = preserveQueryParams("/test", undefined);
    expect(result).toBe("/test");
  });

  it("should return basePath unchanged when no 'v' parameter exists", () => {
    const searchParams = new URLSearchParams("foo=bar&baz=qux");
    const result = preserveQueryParams("/test", searchParams);
    expect(result).toBe("/test");
  });

  it("should append 'v' parameter when no existing query params", () => {
    const searchParams = new URLSearchParams("v=abc123");
    const result = preserveQueryParams("/test", searchParams);
    expect(result).toBe("/test?v=abc123");
  });

  it("should append 'v' parameter when existing query params present", () => {
    const searchParams = new URLSearchParams("v=abc123");
    const result = preserveQueryParams("/test?existing=param", searchParams);
    expect(result).toBe("/test?existing=param&v=abc123");
  });

  it("should properly encode special characters in version parameter", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("v", "special chars&test");
    const result = preserveQueryParams("/test", searchParams);
    expect(result).toBe("/test?v=special%20chars%26test");
  });

  it("should handle empty version parameter", () => {
    const searchParams = new URLSearchParams("v=");
    const result = preserveQueryParams("/test", searchParams);
    expect(result).toBe("/test");
  });

  it("should work with ReadonlyURLSearchParams-like objects", () => {
    const mockSearchParams = {
      get: (key: string) => (key === "v" ? "readonly123" : null),
    } as URLSearchParams;

    const result = preserveQueryParams("/test", mockSearchParams);
    expect(result).toBe("/test?v=readonly123");
  });

  it("should handle paths with fragments", () => {
    const searchParams = new URLSearchParams("v=fragment123");
    const result = preserveQueryParams("/test#section", searchParams);
    expect(result).toBe("/test#section?v=fragment123");
  });

  it("should handle complex URLs with multiple existing parameters", () => {
    const searchParams = new URLSearchParams("v=complex123");
    const result = preserveQueryParams(
      "/path/to/page?param1=value1&param2=value2",
      searchParams,
    );
    expect(result).toBe(
      "/path/to/page?param1=value1&param2=value2&v=complex123",
    );
  });
});

describe("createLinkWithVersion", () => {
  it("should delegate to preserveQueryParams", () => {
    const searchParams = new URLSearchParams("v=delegate123");
    const result = createLinkWithVersion("/test", searchParams);
    expect(result).toBe("/test?v=delegate123");
  });

  it("should handle all preserveQueryParams edge cases", () => {
    expect(createLinkWithVersion("/test", null)).toBe("/test");
    expect(createLinkWithVersion("/test", undefined)).toBe("/test");

    const noVParam = new URLSearchParams("other=param");
    expect(createLinkWithVersion("/test", noVParam)).toBe("/test");
  });

  it("should maintain function signature compatibility", () => {
    const searchParams = new URLSearchParams("v=compatibility123");
    const result1 = createLinkWithVersion("/test", searchParams);
    const result2 = preserveQueryParams("/test", searchParams);
    expect(result1).toBe(result2);
  });
});
