import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { Output } from "@/packages/contracts/slices/first_choice_breakdown/index.contract";
import { handleFirstChoiceDataRequest } from "../handler";

describe("handleFirstChoiceDataRequest", () => {
  it("should return success with first choice data using defaults", async () => {
    const result = await handleFirstChoiceDataRequest();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.electionId).toBe("portland-20241105-gen");
    expect(result.data?.contestId).toBe("d2-3seat");
    expect(result.data?.data).toBeDefined();
    expect(Array.isArray(result.data?.data)).toBe(true);
    expect(result.data?.metadata).toBeDefined();
    expect(result.data?.metadata.contest).toBeDefined();
    expect(result.data?.metadata.artifactUri).toBeDefined();
  });

  it("should return success with custom election and contest params", async () => {
    const result = await handleFirstChoiceDataRequest({
      electionId: "portland-20241105-gen",
      contestId: "d2-3seat",
    });

    expect(result.success).toBe(true);
    expect(result.data?.electionId).toBe("portland-20241105-gen");
    expect(result.data?.contestId).toBe("d2-3seat");
  });

  it("should return 404 when contest not found", async () => {
    const result = await handleFirstChoiceDataRequest({
      electionId: "invalid-election",
      contestId: "invalid-contest",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(404); // Will be 404 because contest is not found
    expect(result.error).toContain(
      "Contest invalid-election/invalid-contest not found",
    );
  });

  it("should return first choice breakdown data", async () => {
    const result = await handleFirstChoiceDataRequest();

    expect(result.success).toBe(true);
    expect(result.data?.data.length).toBeGreaterThan(0);

    // Check structure of first choice breakdown data
    const firstRow = result.data?.data[0];
    expect(firstRow).toHaveProperty("candidate_name");
    expect(firstRow).toHaveProperty("first_choice_votes");
    expect(firstRow).toHaveProperty("pct");
    expect(typeof firstRow?.first_choice_votes).toBe("number");
  });

  it("should validate data against contract schema", async () => {
    const result = await handleFirstChoiceDataRequest();

    expect(result.success).toBe(true);

    // Each row should match the Output schema
    result.data?.data.forEach((row: z.infer<typeof Output>) => {
      expect(row).toHaveProperty("candidate_name");
      expect(row).toHaveProperty("first_choice_votes");
      expect(row).toHaveProperty("pct");
      expect(typeof row.candidate_name).toBe("string");
      expect(typeof row.first_choice_votes).toBe("number");
      expect(typeof row.pct).toBe("number");
      expect(row.first_choice_votes).toBeGreaterThanOrEqual(0);
      expect(row.pct).toBeGreaterThanOrEqual(0);
      expect(row.pct).toBeLessThanOrEqual(100);
    });
  });
});
