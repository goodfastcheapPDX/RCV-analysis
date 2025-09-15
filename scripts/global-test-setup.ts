import { spawn } from "node:child_process";
import { config as dotenv } from "dotenv";
import { validateEnv } from "../src/lib/env";
import { logError, loggers } from "../src/lib/logger";
import { setupTestData } from "./setup-test-data";

// biome-ignore lint/suspicious/noExplicitAny: the spawn process returns god knows what
let testServer: any;

export async function setup() {
  loggers.test.info("🔧 Running global test setup...");

  // Load test environment variables
  dotenv({ path: ".env.test" });

  // Validate environment
  validateEnv();
  loggers.test.debug("Environment variables:", process.env);

  try {
    await setupTestData();

    // Start test server for HTTP-based data loading
    loggers.test.info("🌐 Starting test data server...");
    await startTestServer();

    loggers.test.info("✅ Global test setup completed successfully");
  } catch (error) {
    logError(loggers.test, error, { context: "❌ Global test setup failed" });
    throw error;
  }
}

export async function teardown() {
  loggers.test.info("🧹 Running global test teardown...");

  if (testServer) {
    loggers.test.info("🛑 Stopping test server...");
    testServer.kill();
  }

  loggers.test.info("✅ Global test teardown completed");
}

async function startTestServer() {
  return new Promise<void>((resolve, reject) => {
    // Start http-server on port 8788 serving public/ directory
    testServer = spawn(
      "npx",
      ["http-server", "public", "-p", "8788", "--cors", "-s"],
      {
        stdio: "pipe",
        detached: false,
      },
    );

    let serverReady = false;

    const handleOutput = (data: Buffer) => {
      const output = data.toString();
      // http-server outputs different messages - look for any indication it's running
      if (
        (output.includes("Starting up") ||
          output.includes("Available on") ||
          output.includes("Hit CTRL-C") ||
          output.includes("http://")) &&
        !serverReady
      ) {
        serverReady = true;
        // Set environment variable for tests to use
        process.env.DATA_BASE_URL = "http://localhost:8788";
        loggers.test.info("✅ Test server ready at http://localhost:8788");
        resolve();
      }
    };

    testServer.stdout?.on("data", handleOutput);
    testServer.stderr?.on("data", handleOutput); // http-server may output to stderr

    testServer.on("error", (error: Error) => {
      reject(new Error(`Failed to start test server: ${error.message}`));
    });

    // Shorter timeout and also try a simple connectivity test
    setTimeout(() => {
      if (!serverReady) {
        // Try to connect to see if server is actually running
        fetch("http://localhost:8788/data/test/manifest.json")
          .then(() => {
            loggers.test.info(
              "✅ Test server responding (detected via connectivity test)",
            );
            process.env.DATA_BASE_URL = "http://localhost:8788";
            resolve();
          })
          .catch(() => {
            reject(new Error("Test server failed to start within 5 seconds"));
          });
      }
    }, 5000);
  });
}
