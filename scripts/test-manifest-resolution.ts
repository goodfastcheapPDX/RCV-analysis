#!/usr/bin/env tsx

import { existsSync } from "fs";
import { getContestArtifacts, loadManifestSync } from "@/lib/manifest";

async function main() {
  try {
    console.log("Testing manifest-based data resolution...");

    // Test loading the new manifest
    console.log("1. Loading manifest...");
    const manifest = loadManifestSync();
    console.log(
      `   ✅ Loaded manifest v${manifest.version} with ${manifest.elections.length} elections`,
    );

    // Test finding contest artifacts
    console.log("2. Resolving contest artifacts...");
    const artifacts = getContestArtifacts(
      manifest,
      "portland-20241105-gen",
      "d2-3seat",
    );
    console.log(`   ✅ Found contest: ${artifacts.contest.title}`);

    // Test artifact file existence
    console.log("3. Checking artifact files...");
    const checks = [
      { name: "Candidates", path: artifacts.candidates },
      { name: "Ballots Long", path: artifacts.ballotsLong },
      { name: "First Choice", path: artifacts.firstChoice },
    ];

    for (const check of checks) {
      if (check.path && existsSync(check.path)) {
        console.log(`   ✅ ${check.name}: ${check.path}`);
      } else {
        console.log(
          `   ❌ ${check.name}: ${check.path || "not generated"} (missing)`,
        );
      }
    }

    console.log("4. Validation summary:");
    console.log(`   - Election ID: ${manifest.elections[0].election_id}`);
    console.log(`   - Contest ID: ${artifacts.contest.contest_id}`);
    console.log(`   - District: ${artifacts.contest.district_id}`);
    console.log(`   - Seats: ${artifacts.contest.seat_count}`);
    console.log(`   - Generated at: ${manifest.generated_at}`);

    console.log("\n🎉 Manifest-based data resolution test passed!");
  } catch (error) {
    console.error("❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
