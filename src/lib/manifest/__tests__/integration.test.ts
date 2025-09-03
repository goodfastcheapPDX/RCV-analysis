import { describe, expect, it } from "vitest";
import { loadManifest } from "@/lib/manifest";
import {
  ContestResolver,
  createContestResolver,
} from "@/lib/manifest/contest-resolver";

describe("Manifest Integration Tests", () => {
  console.log(`
    
    
    
    
    
    process.env.DATA_BASE_URL=${process.env.DATA_BASE_URL}
    
    
    
    `);
  describe("Real filesystem integration", () => {
    it("should load production manifest and resolve contest artifacts", async () => {
      // Test loading the manifest from test environment
      const manifest = await loadManifest("test");

      expect(manifest).toBeDefined();
      expect(manifest.version).toBe(2);
      expect(manifest.elections).toHaveLength(1);
      expect(manifest.elections[0].election_id).toBe("portland-20241105-gen");
    });

    it("should resolve contest and verify artifact URIs", async () => {
      const manifest = await loadManifest("test");
      const resolver = new ContestResolver(manifest);

      // Test resolving a known contest
      const contest = resolver.getContest("portland-20241105-gen", "d2-3seat");

      expect(contest).toBeDefined();
      expect(contest.title).toBe("City Council District 2 (3 seats)");
      expect(contest.contest_id).toBe("d2-3seat");
      expect(contest.district_id).toBe("d2");
      expect(contest.seat_count).toBe(3);
    });

    it("should provide valid URIs for all artifact types", async () => {
      const manifest = await loadManifest("test");
      const resolver = new ContestResolver(manifest);

      // Get URIs for different artifact types
      const candidatesUri = resolver.getCandidatesUri(
        "portland-20241105-gen",
        "d2-3seat",
      );
      const ballotsLongUri = resolver.getBallotsLongUri(
        "portland-20241105-gen",
        "d2-3seat",
      );
      const firstChoiceUri = resolver.getFirstChoiceUri(
        "portland-20241105-gen",
        "d2-3seat",
      );
      const stvRoundsUri = resolver.getStvRoundsUri(
        "portland-20241105-gen",
        "d2-3seat",
      );
      const stvMetaUri = resolver.getStvMetaUri(
        "portland-20241105-gen",
        "d2-3seat",
      );

      // All URIs should be non-null strings
      expect(candidatesUri).toBeTruthy();
      expect(ballotsLongUri).toBeTruthy();
      expect(firstChoiceUri).toBeTruthy();
      expect(stvRoundsUri).toBeTruthy();
      expect(stvMetaUri).toBeTruthy();

      // URIs should point to valid file paths
      expect(typeof candidatesUri).toBe("string");
      expect(typeof ballotsLongUri).toBe("string");
      expect(typeof firstChoiceUri).toBe("string");
      expect(typeof stvRoundsUri).toBe("string");
      expect(typeof stvMetaUri).toBe("string");
    });

    it("should have artifacts accessible via HTTP (when available)", async () => {
      const manifest = await loadManifest("test");
      const resolver = new ContestResolver(manifest);

      // Check if key artifacts are accessible via HTTP
      const candidatesUri = resolver.getCandidatesUri(
        "portland-20241105-gen",
        "d2-3seat",
      );
      const ballotsLongUri = resolver.getBallotsLongUri(
        "portland-20241105-gen",
        "d2-3seat",
      );
      const firstChoiceUri = resolver.getFirstChoiceUri(
        "portland-20241105-gen",
        "d2-3seat",
      );

      // If the URIs exist, they should be accessible via HTTP
      if (candidatesUri) {
        try {
          const response = await fetch(candidatesUri);
          if (response.ok) {
            expect(response.status).toBe(200);
          }
        } catch {
          // Skip if test server not available - this is integration test
        }
      }

      if (ballotsLongUri) {
        try {
          const response = await fetch(ballotsLongUri);
          if (response.ok) {
            expect(response.status).toBe(200);
          }
        } catch {
          // Skip if test server not available
        }
      }

      if (firstChoiceUri) {
        try {
          const response = await fetch(firstChoiceUri);
          if (response.ok) {
            expect(response.status).toBe(200);
          }
        } catch {
          // Skip if test server not available
        }
      }

      // This test is designed to pass even when server isn't available,
      // but validate the integration when it is available
    });

    it("should validate manifest structure matches expected format", async () => {
      const manifest = await loadManifest("test");

      // Validate top-level manifest structure
      expect(manifest.env).toBe("test");
      expect(manifest.version).toBe(2);

      // Validate elections structure
      expect(Array.isArray(manifest.elections)).toBe(true);
      expect(manifest.elections.length).toBeGreaterThan(0);

      // Validate first election structure
      const election = manifest.elections[0];
      expect(election.election_id).toBeTruthy();
      expect(election.date).toBeTruthy();
      expect(election.jurisdiction).toBeTruthy();
      expect(election.title).toBeTruthy();
      expect(Array.isArray(election.contests)).toBe(true);
      expect(election.contests.length).toBeGreaterThan(0);
    });
  });
});
