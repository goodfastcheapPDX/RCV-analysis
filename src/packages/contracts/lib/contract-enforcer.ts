import { z } from "zod";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { DuckDBConnection } from "@duckdb/node-api";

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
          (key, value) => (typeof value === "bigint" ? Number(value) : value),
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
    const actualColumns = tableInfo.map((col: any) => col.name as string);

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
  row: Record<string, any>,
): Record<string, any> {
  const processed: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    // Convert bigint to number for count/sum fields
    if (typeof value === "bigint") {
      processed[key] = Number(value);
    } else {
      processed[key] = value;
    }
  }

  return processed;
}
