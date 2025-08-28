import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadManifestFromFs, Manifest } from "./manifest";

vi.mock("node:fs/promises");
const mockFs = vi.mocked(fs);

describe("Contracts Manifest schema", () => {
  it("should validate valid manifest data", () => {
    const validManifest = {
      buildId: "contracts123",
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

  it("should reject manifest with invalid schema", () => {
    const invalidManifest = {
      buildId: "short", // Too short
      elections: [], // Empty array
    };

    expect(() => Manifest.parse(invalidManifest)).toThrow();
  });
});

describe("loadManifestFromFs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should load and parse valid manifest file", async () => {
    const mockManifestData = {
      buildId: "contracts456",
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

    const result = await loadManifestFromFs("test-manifest.json");

    expect(mockFs.readFile).toHaveBeenCalledWith("test-manifest.json", "utf8");
    expect(result).toEqual(mockManifestData);
  });

  it("should use default path when no path provided", async () => {
    const mockManifestData = {
      buildId: "defaultContracts123",
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

    const result = await loadManifestFromFs();

    expect(mockFs.readFile).toHaveBeenCalledWith("manifest.json", "utf8");
    expect(result).toEqual(mockManifestData);
  });

  it("should throw error when file does not exist", async () => {
    const fileError = new Error("ENOENT: no such file or directory");
    mockFs.readFile.mockRejectedValue(fileError);

    await expect(loadManifestFromFs("nonexistent.json")).rejects.toThrow(
      "Failed to load manifest from nonexistent.json: ENOENT: no such file or directory",
    );
  });

  it("should throw error for invalid JSON", async () => {
    mockFs.readFile.mockResolvedValue("invalid json content {");

    await expect(loadManifestFromFs("invalid.json")).rejects.toThrow(
      "Failed to load manifest from invalid.json:",
    );
  });

  it("should throw error for valid JSON but invalid schema", async () => {
    const invalidData = {
      buildId: "short", // Too short
      elections: [], // Empty array
    };

    mockFs.readFile.mockResolvedValue(JSON.stringify(invalidData));

    await expect(loadManifestFromFs("invalid-schema.json")).rejects.toThrow(
      "Failed to load manifest from invalid-schema.json:",
    );
  });

  it("should handle non-Error exceptions", async () => {
    mockFs.readFile.mockRejectedValue("String error");

    await expect(loadManifestFromFs("error.json")).rejects.toThrow(
      "Failed to load manifest from error.json: Unknown error",
    );
  });

  it("should handle file permission errors", async () => {
    const permissionError = new Error("EACCES: permission denied");
    mockFs.readFile.mockRejectedValue(permissionError);

    await expect(loadManifestFromFs("protected.json")).rejects.toThrow(
      "Failed to load manifest from protected.json: EACCES: permission denied",
    );
  });
});
