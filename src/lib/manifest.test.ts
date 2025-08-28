import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadManifest, Manifest } from "./manifest";

vi.mock("node:fs/promises");
const mockFs = vi.mocked(fs);

describe("Manifest schema", () => {
  it("should validate valid manifest data", () => {
    const validManifest = {
      buildId: "abc123",
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [
            {
              id: "test-contest",
              name: "Test Contest",
              seats: 3,
            },
          ],
        },
      ],
    };

    const result = Manifest.parse(validManifest);
    expect(result).toEqual(validManifest);
  });

  it("should reject manifest with short buildId", () => {
    const invalidManifest = {
      buildId: "abc", // Too short
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [
            {
              id: "test-contest",
              name: "Test Contest",
              seats: 3,
            },
          ],
        },
      ],
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });

  it("should reject manifest with empty elections array", () => {
    const invalidManifest = {
      buildId: "abc123",
      elections: [],
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });

  it("should reject manifest with empty contests array", () => {
    const invalidManifest = {
      buildId: "abc123",
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [],
        },
      ],
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });

  it("should reject contest with zero seats", () => {
    const invalidManifest = {
      buildId: "abc123",
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [
            {
              id: "test-contest",
              name: "Test Contest",
              seats: 0,
            },
          ],
        },
      ],
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });

  it("should reject contest with negative seats", () => {
    const invalidManifest = {
      buildId: "abc123",
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [
            {
              id: "test-contest",
              name: "Test Contest",
              seats: -1,
            },
          ],
        },
      ],
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });

  it("should reject contest with non-integer seats", () => {
    const invalidManifest = {
      buildId: "abc123",
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [
            {
              id: "test-contest",
              name: "Test Contest",
              seats: 3.5,
            },
          ],
        },
      ],
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });

  it("should handle multiple elections and contests", () => {
    const validManifest = {
      buildId: "multi123",
      elections: [
        {
          id: "election-1",
          name: "First Election",
          contests: [
            {
              id: "contest-1a",
              name: "Contest 1A",
              seats: 1,
            },
            {
              id: "contest-1b",
              name: "Contest 1B",
              seats: 5,
            },
          ],
        },
        {
          id: "election-2",
          name: "Second Election",
          contests: [
            {
              id: "contest-2a",
              name: "Contest 2A",
              seats: 2,
            },
          ],
        },
      ],
    };

    const result = Manifest.parse(validManifest);
    expect(result).toEqual(validManifest);
    expect(result.elections).toHaveLength(2);
    expect(result.elections[0].contests).toHaveLength(2);
    expect(result.elections[1].contests).toHaveLength(1);
  });
});

describe("loadManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should load and parse valid manifest file", async () => {
    const mockManifestData = {
      buildId: "load123",
      elections: [
        {
          id: "test-election",
          name: "Test Election",
          contests: [
            {
              id: "test-contest",
              name: "Test Contest",
              seats: 3,
            },
          ],
        },
      ],
    };

    mockFs.readFile.mockResolvedValue(JSON.stringify(mockManifestData));

    const result = await loadManifest("test-manifest.json");

    expect(mockFs.readFile).toHaveBeenCalledWith("test-manifest.json", "utf8");
    expect(result).toEqual(mockManifestData);
  });

  it("should use default path when no path provided", async () => {
    const mockManifestData = {
      buildId: "default123",
      elections: [
        {
          id: "default-election",
          name: "Default Election",
          contests: [
            {
              id: "default-contest",
              name: "Default Contest",
              seats: 1,
            },
          ],
        },
      ],
    };

    mockFs.readFile.mockResolvedValue(JSON.stringify(mockManifestData));

    const result = await loadManifest();

    expect(mockFs.readFile).toHaveBeenCalledWith("manifest.json", "utf8");
    expect(result).toEqual(mockManifestData);
  });

  it("should throw error when file does not exist", async () => {
    const fileError = new Error("ENOENT: no such file or directory");
    mockFs.readFile.mockRejectedValue(fileError);

    await expect(loadManifest("nonexistent.json")).rejects.toThrow(
      "Failed to load manifest from nonexistent.json: ENOENT: no such file or directory",
    );
  });

  it("should throw error for invalid JSON", async () => {
    mockFs.readFile.mockResolvedValue("invalid json content {");

    await expect(loadManifest("invalid.json")).rejects.toThrow(
      "Failed to load manifest from invalid.json:",
    );
  });

  it("should throw error for valid JSON but invalid schema", async () => {
    const invalidData = {
      buildId: "short", // Too short
      elections: [], // Empty array
    };

    mockFs.readFile.mockResolvedValue(JSON.stringify(invalidData));

    await expect(loadManifest("invalid-schema.json")).rejects.toThrow(
      "Failed to load manifest from invalid-schema.json:",
    );
  });

  it("should handle non-Error exceptions", async () => {
    mockFs.readFile.mockRejectedValue("String error");

    await expect(loadManifest("error.json")).rejects.toThrow(
      "Failed to load manifest from error.json: Unknown error",
    );
  });

  it("should handle file permission errors", async () => {
    const permissionError = new Error("EACCES: permission denied");
    mockFs.readFile.mockRejectedValue(permissionError);

    await expect(loadManifest("protected.json")).rejects.toThrow(
      "Failed to load manifest from protected.json: EACCES: permission denied",
    );
  });

  it("should preserve all manifest data fields", async () => {
    const complexManifest = {
      buildId: "complex123456",
      elections: [
        {
          id: "election-with-special-chars",
          name: "Election with Special Characters & Symbols",
          contests: [
            {
              id: "single-seat-contest",
              name: "Single Seat Contest",
              seats: 1,
            },
            {
              id: "multi-seat-contest",
              name: "Multi-Seat Contest",
              seats: 10,
            },
          ],
        },
      ],
    };

    mockFs.readFile.mockResolvedValue(JSON.stringify(complexManifest));

    const result = await loadManifest("complex.json");

    expect(result.buildId).toBe("complex123456");
    expect(result.elections[0].name).toBe(
      "Election with Special Characters & Symbols",
    );
    expect(result.elections[0].contests[1].seats).toBe(10);
  });
});
