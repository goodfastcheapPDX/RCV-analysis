#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { logError, loggers } from "../src/lib/logger";

async function runCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {},
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text); // Live output
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text); // Live output
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

async function cleanupTestData() {
  loggers.script.info("🧹 Cleaning up existing test data...");

  const testDataDir = "data/test";
  if (existsSync(testDataDir)) {
    try {
      rmSync(testDataDir, { recursive: true, force: true });
      loggers.script.info("   ✅ Cleaned up data/test directory");
    } catch (error) {
      loggers.script.warn(`   ⚠️  Could not clean data/test: ${error}`);
    }
  }
}

export async function setupTestData() {
  const originalDataEnv = process.env.DATA_ENV;
  const originalSrcCsv = process.env.SRC_CSV;

  try {
    loggers.script.info(
      "🚀 Setting up global test data using build-all-districts script",
    );

    // Clean up existing test data first
    await cleanupTestData();

    // Set up environment for test data generation using golden dataset
    const testEnv = {
      DATA_ENV: "test",
      SRC_CSV: "tests/golden/micro/cvr_small.csv",
    };

    loggers.script.info(
      `   Environment: DATA_ENV=${testEnv.DATA_ENV}, SRC_CSV=${testEnv.SRC_CSV}`,
    );

    // Check if the golden CSV exists
    if (!existsSync(testEnv.SRC_CSV)) {
      throw new Error(`Golden test CSV not found: ${testEnv.SRC_CSV}`);
    }

    // Since build-all-districts expects multiple district CSVs but we have one golden file,
    // we'll run individual computations for the golden dataset
    loggers.script.info("📊 Running test data pipeline with golden dataset...");

    await runCommand(
      "npm",
      ["run", "build:data", "--", "--data-env=test"],
      testEnv,
    );
    await runCommand("npm", ["run", "build:data:firstchoice"], testEnv);
    await runCommand("npm", ["run", "build:data:rankdist"], testEnv);
    await runCommand("npm", ["run", "build:data:stv"], testEnv);

    loggers.script.info(`\n🎉 Global test data setup complete!`);
    loggers.script.info(`   📂 Data available at: data/test/`);

    return { successful: 1, failed: 0 };
  } catch (error) {
    logError(loggers.script, error, {
      context: "Global test data setup failed",
    });
    throw error;
  } finally {
    // Restore original environment
    if (originalDataEnv !== undefined) {
      process.env.DATA_ENV = originalDataEnv;
    } else {
      delete (process.env as Record<string, string | undefined>).DATA_ENV;
    }
    if (originalSrcCsv !== undefined) {
      process.env.SRC_CSV = originalSrcCsv;
    } else {
      delete (process.env as Record<string, string | undefined>).SRC_CSV;
    }
  }
}

// Allow direct execution for manual testing
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestData()
    .then(() => {
      loggers.script.info("✅ Test data setup completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logError(loggers.script, error, { context: "Test data setup failed" });
      process.exit(1);
    });
}
