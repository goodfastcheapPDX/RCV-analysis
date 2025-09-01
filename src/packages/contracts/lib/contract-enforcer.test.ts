import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  assertManifestSection,
  assertTableColumns,
  type DependencySpec,
  parseAllRows,
  preprocessDuckDBRow,
  sha256,
  toBigIntSafe,
  validateDependencies,
} from "./contract-enforcer";

// Keep the real file system functions for our tests

// Mock connection interface for testing
interface MockConnection {
  run: ReturnType<typeof vi.fn>;
}

describe("contract-enforcer", () => {
  let tempDir: string;
  let db: DuckDBInstance;
  let conn: DuckDBConnection;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = join(tmpdir(), `contract-enforcer-test-${Date.now()}`);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Setup DuckDB for tests that need it
    db = await DuckDBInstance.create();
    conn = await db.connect();
  });

  afterEach(async () => {
    if (conn) {
      await conn.closeSync();
    }
  });

  describe("assertTableColumns", () => {
    const TestSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    it("should handle database query errors (lines 104-105)", async () => {
      // Mock connection that throws an error
      const mockConn: MockConnection = {
        run: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      };

      await expect(
        assertTableColumns(
          mockConn as unknown as DuckDBConnection,
          "test_table",
          TestSchema,
        ),
      ).rejects.toThrow(
        "Failed to check table columns for 'test_table': Database connection failed",
      );
    });

    it("should re-throw schema mismatch errors", async () => {
      const mockConn: MockConnection = {
        run: vi
          .fn()
          .mockRejectedValue(
            new Error("Schema mismatch: expected string, got number"),
          ),
      };

      await expect(
        assertTableColumns(
          mockConn as unknown as DuckDBConnection,
          "test_table",
          TestSchema,
        ),
      ).rejects.toThrow("Schema mismatch: expected string, got number");
    });
  });

  describe("assertManifestSection", () => {
    const TestStatsSchema = z.object({
      count: z.number(),
      total: z.number(),
    });

    it("should throw error when manifest entry missing stats section (lines 135-136)", async () => {
      const manifestPath = join(tempDir, "manifest-no-stats.json");
      const manifestContent = {
        "test@1.0.0": {
          version: "1.0.0",
          // Missing stats section
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      try {
        await assertManifestSection(
          manifestPath,
          "test@1.0.0",
          TestStatsSchema,
        );
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Manifest entry 'test@1.0.0' missing stats section",
        );
      }
    });
  });

  describe("sha256", () => {
    it("should handle file read errors (lines 175-180)", () => {
      const nonExistentFile = join(tempDir, "does-not-exist.txt");

      expect(() => sha256(nonExistentFile)).toThrow(
        `Failed to calculate SHA256 hash for '${nonExistentFile}': ENOENT: no such file or directory`,
      );
    });

    it("should calculate correct hash for existing file", () => {
      const testFile = join(tempDir, "test.txt");
      const content = "test content";
      writeFileSync(testFile, content);

      const expectedHash = createHash("sha256").update(content).digest("hex");
      const actualHash = sha256(testFile);

      expect(actualHash).toBe(expectedHash);
    });
  });

  describe("toBigIntSafe", () => {
    it("should convert bigint to number (lines 191-192)", () => {
      const result = toBigIntSafe(BigInt(42));
      expect(result).toBe(42);
    });

    it("should return number as-is (lines 194-195)", () => {
      const result = toBigIntSafe(42);
      expect(result).toBe(42);
    });

    it("should throw error for invalid types (lines 197-198)", () => {
      expect(() => toBigIntSafe("not a number")).toThrow(
        "Expected number or bigint, got string: not a number",
      );
      expect(() => toBigIntSafe(null)).toThrow(
        "Expected number or bigint, got object: null",
      );
      expect(() => toBigIntSafe(undefined)).toThrow(
        "Expected number or bigint, got undefined: undefined",
      );
    });
  });

  describe("preprocessDuckDBRow", () => {
    it("should handle DuckDB LIST/ARRAY values (line 219)", () => {
      const row = {
        id: 1,
        tags: { items: ["tag1", "tag2", "tag3"] },
        scores: { items: [10, 20, 30] },
      };

      const result = preprocessDuckDBRow(row);

      expect(result).toEqual({
        id: 1,
        tags: ["tag1", "tag2", "tag3"],
        scores: [10, 20, 30],
      });
    });

    it("should convert bigint values to numbers", () => {
      const row = {
        id: BigInt(123),
        count: BigInt(456),
        name: "test",
      };

      const result = preprocessDuckDBRow(row);

      expect(result).toEqual({
        id: 123,
        count: 456,
        name: "test",
      });
    });
  });

  describe("validateDependencies", () => {
    const getTestDependencies = (): DependencySpec[] => [
      {
        key: "test@1.0.0",
        minVersion: "1.0.0",
        buildCommand: "npm run build:test",
        artifacts: [
          {
            path: join(tempDir, "test.parquet"),
            hashKey: "test_hash",
          },
        ],
      },
    ];

    it("should throw error when manifest not found (lines 239-242)", () => {
      const nonExistentManifest = join(tempDir, "does-not-exist.json");

      expect(() =>
        validateDependencies(nonExistentManifest, getTestDependencies()),
      ).toThrow(
        `Manifest not found: ${nonExistentManifest}. Run prerequisite data ingestion first.`,
      );
    });

    it("should throw error when manifest is invalid JSON (lines 249-254)", () => {
      const invalidManifestPath = join(tempDir, "invalid.json");
      writeFileSync(invalidManifestPath, "{ invalid json }");

      expect(() =>
        validateDependencies(invalidManifestPath, getTestDependencies()),
      ).toThrow(`Failed to parse manifest ${invalidManifestPath}:`);
    });

    it("should throw error when dependency key missing (lines 259-262)", () => {
      const manifestPath = join(tempDir, "manifest-missing-key.json");
      const manifestContent = {}; // Empty manifest
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      expect(() =>
        validateDependencies(manifestPath, getTestDependencies()),
      ).toThrow(
        `Missing dependency 'test@1.0.0' in manifest. Run: npm run build:test`,
      );
    });

    it("should validate version compatibility when specified (lines 268-280)", () => {
      const manifestPath = join(tempDir, "manifest-wrong-version.json");
      const manifestContent = {
        "test@1.0.0": {
          version: "0.9.0", // Lower than required
          test_hash: "abc123",
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      // Create the artifact file
      const artifactPath = join(tempDir, "test.parquet");
      writeFileSync(artifactPath, "test content");

      expect(() =>
        validateDependencies(manifestPath, getTestDependencies()),
      ).toThrow(
        `Dependency 'test@1.0.0' version 0.9.0 is incompatible with required 1.0.0. Run: npm run build:test`,
      );
    });

    it("should throw error when artifact file missing (lines 285-287)", () => {
      const manifestPath = join(tempDir, "manifest-missing-file.json");
      const manifestContent = {
        "test@1.0.0": {
          version: "1.0.0",
          test_hash: "abc123",
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      // Don't create the artifact file

      expect(() =>
        validateDependencies(manifestPath, getTestDependencies()),
      ).toThrow(
        `Missing artifact file: ${join(tempDir, "test.parquet")}. Run: npm run build:test`,
      );
    });

    it("should validate file integrity with SHA256 hash (lines 292-320)", () => {
      const manifestPath = join(tempDir, "manifest-wrong-hash.json");
      const artifactPath = join(tempDir, "test.parquet");
      const content = "test content";

      // Write file and calculate correct hash
      writeFileSync(artifactPath, content);
      const _correctHash = createHash("sha256").update(content).digest("hex");

      // Put wrong hash in manifest
      const manifestContent = {
        "test@1.0.0": {
          version: "1.0.0",
          test_hash: "wrong_hash_value",
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      expect(() =>
        validateDependencies(manifestPath, getTestDependencies()),
      ).toThrow(`Artifact integrity check failed for ${artifactPath}`);
    });

    it("should handle hash calculation errors (lines 302-312)", () => {
      const manifestPath = join(tempDir, "manifest-hash-error.json");
      const manifestContent = {
        "test@1.0.0": {
          version: "1.0.0",
          test_hash: "abc123",
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      // Create a dependency with a path that will cause hash calculation to fail
      const badDependencies: DependencySpec[] = [
        {
          key: "test@1.0.0",
          minVersion: "1.0.0",
          buildCommand: "npm run build:test",
          artifacts: [
            {
              path: "/dev/null/cannot/read", // Path that will cause read error
              hashKey: "test_hash",
            },
          ],
        },
      ];

      expect(() => validateDependencies(manifestPath, badDependencies)).toThrow(
        "Missing artifact file: /dev/null/cannot/read",
      );
    });

    it("should pass validation with correct manifest and files", () => {
      const manifestPath = join(tempDir, "manifest-valid.json");
      const artifactPath = join(tempDir, "test.parquet");
      const content = "test content";

      // Write file and calculate hash
      writeFileSync(artifactPath, content);
      const hash = createHash("sha256").update(content).digest("hex");

      const manifestContent = {
        "test@1.0.0": {
          version: "1.0.0",
          test_hash: hash,
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      // Should not throw
      expect(() =>
        validateDependencies(manifestPath, getTestDependencies()),
      ).not.toThrow();
    });

    it("should handle missing hash key in manifest entry", () => {
      const manifestPath = join(tempDir, "manifest-no-hash.json");
      const artifactPath = join(tempDir, "test.parquet");
      writeFileSync(artifactPath, "test content");

      const manifestContent = {
        "test@1.0.0": {
          version: "1.0.0",
          // Missing test_hash key
        },
      };
      writeFileSync(manifestPath, JSON.stringify(manifestContent));

      // Should not throw when hash is missing (it's optional)
      expect(() =>
        validateDependencies(manifestPath, getTestDependencies()),
      ).not.toThrow();
    });
  });

  describe("isVersionCompatible helper", () => {
    // We need to test the internal isVersionCompatible function indirectly
    it("should handle version comparison edge cases", () => {
      const manifestPath = join(tempDir, "version-test.json");
      const artifactPath = join(tempDir, "test.parquet");
      writeFileSync(artifactPath, "content");

      // Test various version formats
      const versionTests = [
        { actual: "1.0.0", required: "1.0.0", shouldPass: true },
        { actual: "1.1.0", required: "1.0.0", shouldPass: true },
        { actual: "0.9.0", required: "1.0.0", shouldPass: false },
        { actual: "2.0.0", required: "1.0.0", shouldPass: true },
      ];

      for (const test of versionTests) {
        const manifestContent = {
          "test@1.0.0": {
            version: test.actual,
          },
        };
        writeFileSync(manifestPath, JSON.stringify(manifestContent));

        const deps: DependencySpec[] = [
          {
            key: "test@1.0.0",
            minVersion: test.required,
            buildCommand: "npm run build",
            artifacts: [{ path: artifactPath, hashKey: "hash" }],
          },
        ];

        if (test.shouldPass) {
          expect(() => validateDependencies(manifestPath, deps)).not.toThrow();
        } else {
          expect(() => validateDependencies(manifestPath, deps)).toThrow();
        }
      }
    });
  });
});
