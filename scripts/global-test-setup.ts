import { config as dotenv } from "dotenv";
import { spawn } from "node:child_process";
import { validateEnv } from "../src/lib/env";
import { setupTestData } from "./setup-test-data";

let testServer: any;

export async function setup() {
  console.log("🔧 Running global test setup...");

  // Load test environment variables
  dotenv({ path: ".env.test" });
  dotenv(); // Load base .env as fallback

  // Validate environment
  validateEnv();

  try {
    await setupTestData();
    
    // Start test server for HTTP-based data loading
    console.log("🌐 Starting test data server...");
    await startTestServer();
    
    console.log("✅ Global test setup completed successfully");
  } catch (error) {
    console.error("❌ Global test setup failed:", error);
    throw error;
  }
}

export async function teardown() {
  console.log("🧹 Running global test teardown...");
  
  if (testServer) {
    console.log("🛑 Stopping test server...");
    testServer.kill();
  }
  
  console.log("✅ Global test teardown completed");
}

async function startTestServer() {
  return new Promise<void>((resolve, reject) => {
    // Start http-server on port 8788 serving public/ directory
    testServer = spawn("npx", ["http-server", "public", "-p", "8788", "--cors", "-s"], {
      stdio: "pipe",
      detached: false,
    });

    let serverReady = false;

    const handleOutput = (data: Buffer) => {
      const output = data.toString();
      // http-server outputs different messages - look for any indication it's running
      if ((output.includes("Starting up") || 
           output.includes("Available on") ||
           output.includes("Hit CTRL-C") ||
           output.includes("http://")) && !serverReady) {
        serverReady = true;
        // Set environment variable for tests to use
        process.env.TEST_DATA_BASE_URL = "http://localhost:8788";
        console.log("✅ Test server ready at http://localhost:8788");
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
            console.log("✅ Test server responding (detected via connectivity test)");
            process.env.TEST_DATA_BASE_URL = "http://localhost:8788";
            resolve();
          })
          .catch(() => {
            reject(new Error("Test server failed to start within 5 seconds"));
          });
      }
    }, 5000);
  });
}
