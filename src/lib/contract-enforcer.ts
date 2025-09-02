import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { DuckDBConnection } from "@duckdb/node-api";
import type { z } from "zod";

/**
 * Contract enforcement utilities for ensuring runtime validation of slice outputs.
 *
 * These utilities implement a "contract-first" approach where Zod schemas are the
 * single source of truth, and all artifacts must pass runtime validation.
 */

/**
 * Parse all rows from a DuckDB table through a Zod schema with runtime validation.
 * This ensures the actual DuckDB output matches the declared contract.
 *
 * @param conn - Active DuckDB connection
 * @param table - Table name to query
 * @param Output - Zod schema to validate each row against
 * @returns Validated and parsed rows
 */
export async function parseAllRows<T extends z.ZodTypeAny>(
  conn: DuckDBConnection,
  table: string,
  Output: T,
): Promise<z.infer<T>[]> {
  try {
    const result = await conn.run(`SELECT * FROM ${table}`);
    const rows = await result.getRowObjects();

    return rows.map((row, index) => {
      try {
        // Preprocess DuckDB row to handle BigInt and other type conversions
        const processedRow = preprocessDuckDBRow(row);
        return Output.parse(processedRow);
      } catch (error) {
        // Convert row to JSON safely, handling BigInt
        const safeRowJson = JSON.stringify(
          row,
          (_key, value) => (typeof value === "bigint" ? Number(value) : value),
          2,
        );

        throw new Error(
          `Row ${index} failed schema validation in table '${table}': ${
            error instanceof Error ? error.message : String(error)
          }\nRow data: ${safeRowJson}`,
        );
      }
    });
  } catch (error) {
    throw new Error(
      `Failed to parse rows from table '${table}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Assert that a DuckDB table's columns match the keys of a Zod object schema.
 * This catches schema drift where SQL produces different columns than expected.
 *
 * @param conn - Active DuckDB connection
 * @param table - Table name to check
 * @param Output - Zod object schema to compare against
 */
export async function assertTableColumns<T extends z.ZodRawShape>(
  conn: DuckDBConnection,
  table: string,
  Output: z.ZodObject<T>,
): Promise<void> {
  try {
    const result = await conn.run(`PRAGMA table_info('${table}')`);
    const tableInfo = await result.getRowObjects();
    const actualColumns = tableInfo.map((col) => col.name as string);

    const expectedColumns = Object.keys(Output.shape);
    const actualSet = new Set(actualColumns);
    const expectedSet = new Set(expectedColumns);

    const missing = expectedColumns.filter((col) => !actualSet.has(col));
    const extra = actualColumns.filter((col) => !expectedSet.has(col));

    if (missing.length > 0 || extra.length > 0) {
      const details = [];
      if (missing.length > 0) {
        details.push(`Missing columns: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        details.push(`Extra columns: ${extra.join(", ")}`);
      }

      throw new Error(
        `Schema mismatch for table '${table}'.\n${details.join("; ")}\n` +
          `Expected: [${expectedColumns.sort().join(", ")}]\n` +
          `Actual: [${actualColumns.sort().join(", ")}]`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Schema mismatch")) {
      throw error; // Re-throw our formatted error
    }
    throw new Error(
      `Failed to check table columns for '${table}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Validate a section of the manifest.json against a Zod schema.
 * This ensures manifest stats conform to their declared contracts.
 *
 * @param manifestPath - Path to manifest.json file
 * @param key - Key in manifest to validate (e.g., "first_choice_breakdown@1.0.0")
 * @param Stats - Zod schema for the stats section
 */
export function assertManifestSection<T extends z.ZodRawShape>(
  manifestPath: string,
  key: string,
  Stats: z.ZodObject<T>,
): void {
  try {
    const manifestContent = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestContent);

    if (!manifest[key]) {
      throw new Error(`Manifest missing key: ${key}`);
    }

    const entry = manifest[key];
    if (!entry.stats) {
      throw new Error(`Manifest entry '${key}' missing stats section`);
    }

    try {
      Stats.parse(entry.stats);
    } catch (error) {
      throw new Error(
        `Stats validation failed for manifest key '${key}': ${
          error instanceof Error ? error.message : String(error)
        }\nStats data: ${JSON.stringify(entry.stats, null, 2)}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Stats validation failed")
    ) {
      throw error; // Re-throw our formatted error
    }
    throw new Error(
      `Failed to validate manifest section '${key}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Calculate SHA256 hash of a file for deterministic content verification.
 *
 * @param filePath - Path to file to hash
 * @returns SHA256 hash as hex string
 */
export function sha256(filePath: string): string {
  try {
    const fileBuffer = readFileSync(filePath);
    const hash = createHash("sha256");
    hash.update(fileBuffer);
    return hash.digest("hex");
  } catch (error) {
    throw new Error(
      `Failed to calculate SHA256 hash for '${filePath}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Helper to convert DuckDB bigint values to regular numbers for Zod validation.
 * DuckDB returns COUNT() and SUM() as bigint, but our schemas expect number.
 *
 * @param value - Value that might be bigint
 * @returns Regular number
 */
export function toBigIntSafe(value: unknown): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  throw new Error(`Expected number or bigint, got ${typeof value}: ${value}`);
}

/**
 * Validate and convert DuckDB row data to handle type differences.
 * This preprocessor handles DuckDB-specific types before Zod validation.
 *
 * @param row - Raw row from DuckDB
 * @returns Row with converted types
 */
export function preprocessDuckDBRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const processed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    // Convert bigint to number for count/sum fields
    if (typeof value === "bigint") {
      processed[key] = Number(value);
    }
    // Convert DuckDB LIST/ARRAY values to plain JavaScript arrays
    else if (value && typeof value === "object" && "items" in value) {
      processed[key] = (value as { items: unknown[] }).items;
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

/**
 * Validate dependencies from manifest before running a slice compute function.
 * This ensures required artifacts exist, have correct versions, and pass integrity checks.
 *
 * @param manifestPath - Path to manifest.json file
 * @param dependencies - Array of dependency specifications
 */
export function validateDependencies(
  manifestPath: string,
  dependencies: DependencySpec[],
): void {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Manifest not found: ${manifestPath}. Run prerequisite data ingestion first.`,
    );
  }

  let manifest: Record<string, unknown>;
  try {
    const manifestContent = readFileSync(manifestPath, "utf8");
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    throw new Error(
      `Failed to parse manifest ${manifestPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  for (const dep of dependencies) {
    // Check manifest entry exists
    if (!manifest[dep.key]) {
      throw new Error(
        `Missing dependency '${dep.key}' in manifest. Run: ${dep.buildCommand}`,
      );
    }

    const entry = manifest[dep.key];

    // Check version compatibility if specified
    if (
      dep.minVersion &&
      entry &&
      typeof entry === "object" &&
      entry !== null &&
      "version" in entry &&
      typeof entry.version === "string"
    ) {
      if (!isVersionCompatible(entry.version as string, dep.minVersion)) {
        throw new Error(
          `Dependency '${dep.key}' version ${entry.version as string} is incompatible with required ${dep.minVersion}. Run: ${dep.buildCommand}`,
        );
      }
    }

    // Check file existence and integrity
    for (const artifact of dep.artifacts) {
      if (!existsSync(artifact.path)) {
        throw new Error(
          `Missing artifact file: ${artifact.path}. Run: ${dep.buildCommand}`,
        );
      }

      // Verify file integrity using SHA256 hash
      const expectedHash =
        entry &&
        typeof entry === "object" &&
        entry !== null &&
        artifact.hashKey in entry
          ? (entry as Record<string, unknown>)[artifact.hashKey]
          : null;
      if (expectedHash) {
        let actualHash: string;
        try {
          actualHash = sha256(artifact.path);
        } catch (error) {
          throw new Error(
            `Failed to verify integrity of ${artifact.path}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        if (actualHash !== expectedHash) {
          throw new Error(
            `Artifact integrity check failed for ${artifact.path}. ` +
              `Expected hash: ${expectedHash}, actual: ${actualHash}. ` +
              `Run: ${dep.buildCommand}`,
          );
        }
      }
    }
  }
}

/**
 * Specification for a dependency that should be validated
 */
export interface DependencySpec {
  /** Manifest key to check (e.g., "ingest_cvr@1.0.0") */
  key: string;
  /** Minimum compatible version (optional) */
  minVersion?: string;
  /** Command to run if dependency is missing/invalid */
  buildCommand: string;
  /** Artifacts to check for existence and integrity */
  artifacts: {
    /** Path to the artifact file */
    path: string;
    /** Key in manifest entry containing the expected SHA256 hash */
    hashKey: string;
  }[];
}

/**
 * Simple semantic version compatibility check.
 * Returns true if actual version is >= required version.
 */
function isVersionCompatible(actual: string, required: string): boolean {
  const parseVersion = (v: string) => v.split(".").map(Number);
  const actualParts = parseVersion(actual);
  const requiredParts = parseVersion(required);

  for (let i = 0; i < Math.max(actualParts.length, requiredParts.length); i++) {
    const actualPart = actualParts[i] || 0;
    const requiredPart = requiredParts[i] || 0;

    if (actualPart > requiredPart) return true;
    if (actualPart < requiredPart) return false;
  }

  return true; // Equal versions are compatible
}
