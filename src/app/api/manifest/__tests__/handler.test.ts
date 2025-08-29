import { beforeAll, describe, expect, it } from "vitest";
import { handleManifestRequest } from "../handler";
import { ingestCvr } from "@/packages/contracts/slices/ingest_cvr/compute";

describe("handleManifestRequest", () => {
  beforeAll(async () => {
    // Generate test data
    await ingestCvr();
  });

  it("should return success with manifest data", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.version).toBe(2);
    expect(result.data?.env).toBe("test");
    expect(result.data?.elections).toBeDefined();
  });

  it("should include election data in manifest", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.elections)).toBe(true);
    expect(result.data?.elections.length).toBeGreaterThan(0);

    const election = result.data?.elections[0];
    expect(election).toHaveProperty('election_id');
    expect(election).toHaveProperty('contests');
  });
});