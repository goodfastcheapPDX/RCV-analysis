import { describe, expect, it } from "vitest";
import { createStvRoundsOutputFixture } from "@/contracts/slices/stv_rounds/index.contract";
import { handleStvDataRequest } from "../handler";

describe("handleStvDataRequest", () => {
  it("should return success with STV data using defaults", async () => {
    const result = await handleStvDataRequest();
    const defaultFixture = createStvRoundsOutputFixture();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.electionId).toBe(defaultFixture.election_id);
    expect(result.data?.contestId).toBe(defaultFixture.contest_id);
    expect(result.data?.roundsData).toBeDefined();
    expect(result.data?.metaData).toBeDefined();
    expect(result.data?.metadata).toBeDefined();
  });

  it("should return success with specific election and contest IDs", async () => {
    const testFixture = createStvRoundsOutputFixture();
    const result = await handleStvDataRequest({
      electionId: testFixture.election_id,
      contestId: testFixture.contest_id,
    });

    expect(result.success).toBe(true);
    expect(result.data?.electionId).toBe(testFixture.election_id);
    expect(result.data?.contestId).toBe(testFixture.contest_id);
  });

  it("should return valid rounds data structure", async () => {
    const result = await handleStvDataRequest();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.roundsData)).toBe(true);

    if (result.data?.roundsData && result.data.roundsData.length > 0) {
      const round = result.data.roundsData[0];
      expect(round).toHaveProperty("round");
      expect(round).toHaveProperty("candidate_name");
      expect(round).toHaveProperty("votes");
      expect(round).toHaveProperty("status");
      expect(typeof round.round).toBe("number");
      expect(typeof round.candidate_name).toBe("string");
      expect(typeof round.votes).toBe("number");
      expect(typeof round.status).toBe("string");
    }
  });

  it("should return valid meta data structure", async () => {
    const result = await handleStvDataRequest();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.metaData)).toBe(true);

    if (result.data?.metaData && result.data.metaData.length > 0) {
      const meta = result.data.metaData[0];
      expect(meta).toHaveProperty("round");
      expect(meta).toHaveProperty("election_id");
      expect(meta).toHaveProperty("contest_id");
      expect(meta).toHaveProperty("quota");
      expect(typeof meta.round).toBe("number");
      expect(typeof meta.election_id).toBe("string");
      expect(typeof meta.contest_id).toBe("string");
      expect(typeof meta.quota).toBe("number");
    }
  });

  it("should include stats from manifest", async () => {
    const result = await handleStvDataRequest();

    expect(result.success).toBe(true);
    expect(result.data?.stats).toBeDefined();

    if (result.data?.stats) {
      expect(typeof result.data.stats.number_of_rounds).toBe("number");
      expect(Array.isArray(result.data.stats.winners)).toBe(true);
      expect(typeof result.data.stats.seats).toBe("number");
      expect(typeof result.data.stats.first_round_quota).toBe("number");
      expect(typeof result.data.stats.precision).toBe("number");
    }
  });

  it("should include metadata with file paths", async () => {
    const result = await handleStvDataRequest();

    expect(result.success).toBe(true);
    expect(result.data?.metadata).toBeDefined();
    expect(result.data?.metadata?.contest).toBeDefined();
    expect(result.data?.metadata?.roundsUri).toBeDefined();
    expect(result.data?.metadata?.metaUri).toBeDefined();
    expect(typeof result.data?.metadata?.roundsUri).toBe("string");
    expect(typeof result.data?.metadata?.metaUri).toBe("string");
  });

  it("should return error for non-existent election", async () => {
    const result = await handleStvDataRequest({
      electionId: "non-existent",
      contestId: "d2-3seat",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect([404, 500]).toContain(result.status);
  });

  it("should return error for non-existent contest", async () => {
    const result = await handleStvDataRequest({
      electionId: "portland-20241105-gen",
      contestId: "non-existent",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect([404, 500]).toContain(result.status);
  });

  it("should handle empty params object", async () => {
    const result = await handleStvDataRequest({});

    expect(result.success).toBe(true);
    expect(result.data?.electionId).toBe("portland-20241105-gen");
    expect(result.data?.contestId).toBe("d2-3seat");
  });

  it("should validate that rounds data contains expected candidates", async () => {
    const result = await handleStvDataRequest();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.roundsData)).toBe(true);

    if (result.data?.roundsData) {
      const candidateNames = new Set(
        result.data.roundsData.map((r) => r.candidate_name),
      );
      expect(candidateNames.size).toBeGreaterThan(0);

      // Should contain some actual candidate names (not just empty)
      const nonEmptyNames = Array.from(candidateNames).filter(
        (name) => name.trim().length > 0,
      );
      expect(nonEmptyNames.length).toBeGreaterThan(0);
    }
  });

  it("should validate that meta data contains expected fields", async () => {
    const result = await handleStvDataRequest();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.metaData)).toBe(true);

    if (result.data?.metaData) {
      const rounds = new Set(result.data.metaData.map((m) => m.round));
      expect(rounds.size).toBeGreaterThan(0);

      // Should have election IDs for all entries
      const allHaveElectionIds = result.data.metaData.every(
        (m) => typeof m.election_id === "string" && m.election_id.length > 0,
      );
      expect(allHaveElectionIds).toBe(true);
    }
  });
});
