import { setupTestData } from "./setup-test-data";

export async function setup() {
  console.log("🔧 Running global test setup...");
  try {
    await setupTestData();
    console.log("✅ Global test setup completed successfully");
  } catch (error) {
    console.error("❌ Global test setup failed:", error);
    throw error;
  }
}

export async function teardown() {
  console.log("🧹 Running global test teardown...");
  // We could clean up test data here, but leaving it for debugging is often useful
  // The next test run will clean it up anyway
  console.log("✅ Global test teardown completed");
}
