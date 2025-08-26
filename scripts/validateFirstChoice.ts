import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync, existsSync } from "fs";
import {
  FirstChoiceBreakdownRowSchema,
  CONTRACT_VERSION,
} from "../src/packages/contracts/slices/first_choice_breakdown/index.contract.js";

interface OfficialResult {
  candidate: string;
  firstChoice?: number;
  first_choice?: number;
  "1st Choice"?: number;
}

function normalizeCandidate(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

async function validateStructural(): Promise<void> {
  console.log("Running structural validation...");

  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    // Load the output file
    await conn.run(
      "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
    );

    // Check for NULL candidate names
    const nullCandidatesResult = await conn.run(
      "SELECT COUNT(*) as count FROM first_choice WHERE candidate_name IS NULL;",
    );
    const nullCandidates = await nullCandidatesResult.getRowObjects();
    if (Number(nullCandidates[0].count) > 0) {
      throw new Error(
        `Found ${nullCandidates[0].count} rows with NULL candidate_name`,
      );
    }

    // Check for negative vote counts
    const negativeVotesResult = await conn.run(
      "SELECT COUNT(*) as count FROM first_choice WHERE first_choice_votes < 0;",
    );
    const negativeVotes = await negativeVotesResult.getRowObjects();
    if (Number(negativeVotes[0].count) > 0) {
      throw new Error(
        `Found ${negativeVotes[0].count} rows with negative first_choice_votes`,
      );
    }

    // Check percentage bounds
    const invalidPctResult = await conn.run(
      "SELECT COUNT(*) as count FROM first_choice WHERE pct < 0 OR pct > 100;",
    );
    const invalidPct = await invalidPctResult.getRowObjects();
    if (Number(invalidPct[0].count) > 0) {
      throw new Error(
        `Found ${invalidPct[0].count} rows with pct outside 0-100 range`,
      );
    }

    // Check percentage sum
    const pctSumResult = await conn.run(
      "SELECT SUM(pct) as total_pct FROM first_choice;",
    );
    const pctSum = await pctSumResult.getRowObjects();
    const totalPct = Number(pctSum[0].total_pct);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error(
        `Percentage sum ${totalPct} deviates from 100 by more than 0.01`,
      );
    }

    console.log("✓ Structural validation passed");
  } finally {
    await conn.closeSync();
  }
}

async function validateSemantic(): Promise<void> {
  console.log("Running semantic validation...");

  // Load manifest
  if (!existsSync("manifest.json")) {
    throw new Error("manifest.json not found");
  }

  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  const ingestCvrEntry = manifest[`ingest_cvr@1.0.0`];
  const firstChoiceEntry =
    manifest[`first_choice_breakdown@${CONTRACT_VERSION}`];

  if (!ingestCvrEntry) {
    throw new Error("ingest_cvr@1.0.0 entry not found in manifest");
  }

  if (!firstChoiceEntry) {
    throw new Error(
      `first_choice_breakdown@${CONTRACT_VERSION} entry not found in manifest`,
    );
  }

  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run(
      "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
    );

    // Get count of first choice votes from ballots_long directly for verification
    await conn.run(
      "CREATE VIEW ballots_long AS SELECT * FROM 'data/ingest/ballots_long.parquet';",
    );
    const actualFirstChoicesResult = await conn.run(
      "SELECT COUNT(*) as actual_count FROM ballots_long WHERE rank_position = 1 AND has_vote = TRUE;",
    );
    const actualFirstChoices = await actualFirstChoicesResult.getRowObjects();

    // Check total votes against actual first choice count from source data
    const totalVotesResult = await conn.run(
      "SELECT SUM(first_choice_votes) as total FROM first_choice;",
    );
    const totalVotes = await totalVotesResult.getRowObjects();

    if (
      Number(totalVotes[0].total) !== Number(actualFirstChoices[0].actual_count)
    ) {
      throw new Error(
        `Sum of first_choice_votes (${totalVotes[0].total}) does not match actual first choices in ballots_long (${actualFirstChoices[0].actual_count})`,
      );
    }

    // Verify manifest stats match actual data (convert bigint to number for comparison)
    if (
      firstChoiceEntry.stats.sum_first_choice !== Number(totalVotes[0].total)
    ) {
      throw new Error(
        `Manifest sum_first_choice (${firstChoiceEntry.stats.sum_first_choice}) does not match actual sum (${totalVotes[0].total})`,
      );
    }

    const candidateCountResult = await conn.run(
      "SELECT COUNT(DISTINCT candidate_name) as count FROM first_choice;",
    );
    const candidateCount = await candidateCountResult.getRowObjects();

    if (
      firstChoiceEntry.stats.candidate_count !== Number(candidateCount[0].count)
    ) {
      throw new Error(
        `Manifest candidate_count (${firstChoiceEntry.stats.candidate_count}) does not match actual count (${candidateCount[0].count})`,
      );
    }

    console.log("✓ Semantic validation passed");
  } finally {
    await conn.closeSync();
  }
}

async function validateOfficialResults(caseName: string): Promise<void> {
  const officialPath = `tests/golden/${caseName}/official-results.json`;

  if (!existsSync(officialPath)) {
    console.log(
      `⚠ No official results file found at ${officialPath}, skipping official comparison`,
    );
    return;
  }

  console.log("Running official results validation...");

  const officialResults: OfficialResult[] = JSON.parse(
    readFileSync(officialPath, "utf8"),
  );

  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();

  try {
    await conn.run(
      "CREATE VIEW first_choice AS SELECT * FROM 'data/summary/first_choice.parquet';",
    );
    const computedResult = await conn.run(
      "SELECT candidate_name, first_choice_votes FROM first_choice ORDER BY candidate_name;",
    );
    const computedRows = await computedResult.getRowObjects();

    // Build lookup maps with normalized names
    const officialMap = new Map<string, number>();
    officialResults.forEach((result) => {
      const normalizedName = normalizeCandidate(result.candidate);
      const votes =
        result.firstChoice || result.first_choice || result["1st Choice"];
      if (votes !== undefined) {
        officialMap.set(normalizedName, votes);
      }
    });

    const computedMap = new Map<string, number>();
    computedRows.forEach((row: any) => {
      const normalizedName = normalizeCandidate(row.candidate_name);
      computedMap.set(normalizedName, row.first_choice_votes);
    });

    // Check for missing candidates in either direction
    const officialCandidates = Array.from(officialMap.keys());
    const computedCandidates = Array.from(computedMap.keys());

    const missingInComputed = officialCandidates.filter(
      (name) => !computedMap.has(name),
    );
    const missingInOfficial = computedCandidates.filter(
      (name) => !officialMap.has(name),
    );

    if (missingInComputed.length > 0 || missingInOfficial.length > 0) {
      let errorMsg = "Candidate mismatch:\n";
      if (missingInComputed.length > 0) {
        errorMsg += `Missing in computed: ${missingInComputed.join(", ")}\n`;
      }
      if (missingInOfficial.length > 0) {
        errorMsg += `Missing in official: ${missingInOfficial.join(", ")}\n`;
      }
      throw new Error(errorMsg);
    }

    // Compare vote counts
    let hasErrors = false;
    for (const [candidate, officialVotes] of officialMap) {
      const computedVotes = computedMap.get(candidate);
      if (computedVotes !== officialVotes) {
        console.error(
          `❌ ${candidate}: expected ${officialVotes}, got ${computedVotes}`,
        );
        hasErrors = true;
      }
    }

    if (hasErrors) {
      throw new Error("Vote count mismatches found");
    }

    console.log("✓ Official results validation passed");
  } finally {
    await conn.closeSync();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const caseFlag = args.findIndex((arg) => arg === "--case");
  const allFlag = args.includes("--all");

  try {
    // Always run structural and semantic validation
    await validateStructural();
    await validateSemantic();

    if (allFlag) {
      // Validate against all available golden cases
      const { readdirSync } = await import("fs");
      if (existsSync("tests/golden")) {
        const cases = readdirSync("tests/golden", { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        for (const caseName of cases) {
          console.log(`\nValidating case: ${caseName}`);
          await validateOfficialResults(caseName);
        }
      }
    } else if (caseFlag >= 0 && args[caseFlag + 1]) {
      const caseName = args[caseFlag + 1];
      await validateOfficialResults(caseName);
    } else {
      // Try to validate against micro case by default
      await validateOfficialResults("micro");
    }

    console.log("\n✅ All validations passed!");
  } catch (error) {
    console.error(
      "\n❌ Validation failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Validation script error:", error);
  process.exit(1);
});
