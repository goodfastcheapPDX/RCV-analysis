import { beforeAll, describe, expect, it } from "vitest";
import { computeFirstChoiceBreakdown } from "@/packages/contracts/slices/first_choice_breakdown/compute";
import { ingestCvr } from "@/packages/contracts/slices/ingest_cvr/compute";
import { computeStvRounds } from "@/packages/contracts/slices/stv_rounds/compute";
import { handleManifestRequest } from "../handler";

describe("handleManifestRequest", () => {
  beforeAll(async () => {
    // Generate test data
    await ingestCvr();
    await computeFirstChoiceBreakdown();
    await computeStvRounds();
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
    expect(election).toHaveProperty("election_id");
    expect(election).toHaveProperty("contests");
  });

  it("should validate manifest structure", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("version");
    expect(result.data).toHaveProperty("env");
    expect(result.data).toHaveProperty("elections");
    expect(result.data).toHaveProperty("generated_at");
    expect(result.data).toHaveProperty("inputs");
    expect(typeof result.data?.version).toBe("number");
    expect(typeof result.data?.env).toBe("string");
    expect(typeof result.data?.generated_at).toBe("string");
  });

  it("should include contest structure with required properties", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    const election = result.data?.elections[0];
    expect(Array.isArray(election?.contests)).toBe(true);
    expect(election?.contests.length).toBeGreaterThan(0);

    const contest = election?.contests[0];
    expect(contest).toHaveProperty("contest_id");
    expect(contest).toHaveProperty("title");
    expect(contest).toHaveProperty("district_id");
    expect(contest).toHaveProperty("seat_count");
    expect(contest).toHaveProperty("cvr");
    expect(contest).toHaveProperty("stv");
    expect(contest).toHaveProperty("rules");
    expect(typeof contest?.contest_id).toBe("string");
    expect(typeof contest?.title).toBe("string");
    expect(typeof contest?.seat_count).toBe("number");
  });

  it("should include CVR section with candidate and ballot data", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    const contest = result.data?.elections[0]?.contests[0];
    expect(contest?.cvr).toBeDefined();
    expect(contest?.cvr?.candidates).toBeDefined();
    expect(contest?.cvr?.ballots_long).toBeDefined();

    const candidates = contest?.cvr?.candidates;
    expect(typeof candidates?.uri).toBe("string");
    expect(typeof candidates?.sha256).toBe("string");
    expect(typeof candidates?.rows).toBe("number");

    const ballots = contest?.cvr?.ballots_long;
    expect(typeof ballots?.uri).toBe("string");
    expect(typeof ballots?.sha256).toBe("string");
    expect(typeof ballots?.rows).toBe("number");
  });

  it("should include first choice breakdown section", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    const contest = result.data?.elections[0]?.contests[0];
    expect(contest?.first_choice).toBeDefined();

    const firstChoice = contest?.first_choice;
    expect(typeof firstChoice?.uri).toBe("string");
    expect(typeof firstChoice?.sha256).toBe("string");
    expect(typeof firstChoice?.rows).toBe("number");
  });

  it("should include STV section with stats and artifacts", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    const contest = result.data?.elections[0]?.contests[0];
    expect(contest?.stv).toBeDefined();
    expect(contest?.stv?.rounds).toBeDefined();
    expect(contest?.stv?.meta).toBeDefined();
    expect(contest?.stv?.stats).toBeDefined();

    const rounds = contest?.stv?.rounds;
    expect(typeof rounds?.uri).toBe("string");
    expect(typeof rounds?.sha256).toBe("string");
    expect(typeof rounds?.rows).toBe("number");

    const meta = contest?.stv?.meta;
    expect(typeof meta?.uri).toBe("string");
    expect(typeof meta?.sha256).toBe("string");
    expect(typeof meta?.rows).toBe("number");

    const stvStats = contest?.stv?.stats;
    expect(typeof stvStats?.number_of_rounds).toBe("number");
    expect(Array.isArray(stvStats?.winners)).toBe(true);
    expect(typeof stvStats?.seats).toBe("number");
    expect(typeof stvStats?.first_round_quota).toBe("number");
  });

  it("should contain valid election ID and contest ID", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);
    const election = result.data?.elections[0];
    expect(election?.election_id).toBe("portland-20241105-gen");
    expect(election?.contests[0]?.contest_id).toBe("d2-3seat");
  });

  it("should have consistent timestamps", async () => {
    const result = await handleManifestRequest();

    expect(result.success).toBe(true);

    // Check that generated_at is a valid ISO string
    const generatedAt = result.data?.generated_at;
    expect(generatedAt).toBeDefined();
    expect(() => new Date(generatedAt!)).not.toThrow();

    // Check that the timestamp is recent (within last hour)
    const timestamp = new Date(generatedAt!);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
  });

  it("should handle consistent data structure across multiple calls", async () => {
    const result1 = await handleManifestRequest();
    const result2 = await handleManifestRequest();

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.data?.version).toBe(result2.data?.version);
    expect(result1.data?.env).toBe(result2.data?.env);
    expect(result1.data?.elections.length).toBe(result2.data?.elections.length);
  });
});
