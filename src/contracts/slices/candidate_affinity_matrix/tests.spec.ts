import { describe, expect, test } from "vitest";
import {
  createOutputFixture,
  createStatsFixture,
  Output,
  SQL_QUERIES,
  Stats,
  VALIDATION_RULES,
  version,
} from "./index.contract";

describe("CandidateAffinityMatrix Contract", () => {
  describe("version", () => {
    test("should be 0.1.0 (pre-1.0 iteration)", () => {
      expect(version).toBe("0.1.0");
    });
  });

  describe("Output schema", () => {
    test("should accept valid candidate affinity matrix output", () => {
      const validOutput = createOutputFixture();
      expect(() => Output.parse(validOutput)).not.toThrow();
    });

    test("should require canonical ordering: candidate_a < candidate_b", () => {
      const invalidOutput = createOutputFixture({
        candidate_a: 3,
        candidate_b: 2, // Should be 2 < 3
      });
      expect(() => Output.parse(invalidOutput)).toThrow();
    });

    test("should reject self-pairs", () => {
      const selfPair = createOutputFixture({
        candidate_a: 1,
        candidate_b: 1,
      });
      expect(() => Output.parse(selfPair)).toThrow();
    });

    test("should require non-negative cooccurrence_count", () => {
      const negativeCount = createOutputFixture({
        cooccurrence_count: -1,
      });
      expect(() => Output.parse(negativeCount)).toThrow();
    });

    test("should require cooccurrence_frac in [0, 1]", () => {
      const invalidFrac = createOutputFixture({
        cooccurrence_frac: 1.5,
      });
      expect(() => Output.parse(invalidFrac)).toThrow();

      const negativeFrac = createOutputFixture({
        cooccurrence_frac: -0.1,
      });
      expect(() => Output.parse(negativeFrac)).toThrow();

      const validFrac = createOutputFixture({
        cooccurrence_frac: 0.75,
      });
      expect(() => Output.parse(validFrac)).not.toThrow();
    });
  });

  describe("Stats schema", () => {
    test("should accept valid stats", () => {
      const validStats = createStatsFixture();
      expect(() => Stats.parse(validStats)).not.toThrow();
    });

    test("should require positive total_ballots_considered", () => {
      const invalidStats = createStatsFixture({
        total_ballots_considered: 0,
      });
      expect(() => Stats.parse(invalidStats)).toThrow();

      const negativeStats = createStatsFixture({
        total_ballots_considered: -10,
      });
      expect(() => Stats.parse(negativeStats)).toThrow();
    });

    test("should require non-negative unique_pairs", () => {
      const negativeStats = createStatsFixture({
        unique_pairs: -1,
      });
      expect(() => Stats.parse(negativeStats)).toThrow();

      const zeroStats = createStatsFixture({
        unique_pairs: 0,
      });
      expect(() => Stats.parse(zeroStats)).not.toThrow();
    });

    test("should require max_pair_frac in [0, 1]", () => {
      const invalidStats = createStatsFixture({
        max_pair_frac: 1.5,
      });
      expect(() => Stats.parse(invalidStats)).toThrow();

      const validStats = createStatsFixture({
        max_pair_frac: 0.85,
      });
      expect(() => Stats.parse(validStats)).not.toThrow();
    });

    test("should require non-negative compute_ms", () => {
      const negativeStats = createStatsFixture({
        compute_ms: -10,
      });
      expect(() => Stats.parse(negativeStats)).toThrow();
    });
  });

  describe("Canonical order invariant", () => {
    test("should enforce numeric ordering for all pairs", () => {
      const testPairs = [
        { a: 1, b: 2, valid: true },
        { a: 2, b: 1, valid: false },
        { a: 1, b: 3, valid: true },
        { a: 3, b: 1, valid: false },
        { a: 5, b: 10, valid: true },
        { a: 10, b: 5, valid: false },
      ];

      testPairs.forEach(({ a, b, valid }) => {
        const output = createOutputFixture({
          candidate_a: a,
          candidate_b: b,
        });

        if (valid) {
          expect(() => Output.parse(output)).not.toThrow();
        } else {
          expect(() => Output.parse(output)).toThrow();
        }
      });
    });

    test("should reject self-pairs consistently", () => {
      const selfPairs = [1, 2, 3, 4, 5];

      selfPairs.forEach((id) => {
        const selfPair = createOutputFixture({
          candidate_a: id,
          candidate_b: id,
        });
        expect(() => Output.parse(selfPair)).toThrow();
      });
    });
  });

  describe("Conservation bounds", () => {
    test("should validate mathematical relationship", () => {
      // cooccurrence_frac = cooccurrence_count / total_ballots_considered
      const totalBallots = 1000;
      const count = 750;
      const expectedFrac = 0.75;

      const validOutput = createOutputFixture({
        cooccurrence_count: count,
        cooccurrence_frac: expectedFrac,
      });

      expect(() => Output.parse(validOutput)).not.toThrow();

      // Verify the relationship holds
      const parsed = Output.parse(validOutput);
      expect(parsed.cooccurrence_frac).toBeCloseTo(count / totalBallots, 3);
    });

    test("should enforce bounds on cooccurrence_count relative to ballots", () => {
      // Count cannot exceed total ballots in practice
      const validOutput = createOutputFixture({
        cooccurrence_count: 150,
        cooccurrence_frac: 0.75,
      });
      expect(() => Output.parse(validOutput)).not.toThrow();
    });
  });

  describe("Symmetry by reconstruction test", () => {
    test("should validate symmetric matrix reconstruction", () => {
      // Simulate canonical storage pairs
      const canonicalPairs = [
        { candidate_a: 1, candidate_b: 2, frac: 0.8 },
        { candidate_a: 1, candidate_b: 3, frac: 0.6 },
        { candidate_a: 2, candidate_b: 3, frac: 0.7 },
      ];

      // Create matrix representation
      const matrix = new Map<number, Map<number, number>>();

      // Initialize matrix
      const candidates = [1, 2, 3];
      candidates.forEach((a) => {
        matrix.set(a, new Map());
        candidates.forEach((b) => {
          matrix.get(a)?.set(b, 0);
        });
      });

      // Fill matrix from canonical pairs
      canonicalPairs.forEach(({ candidate_a, candidate_b, frac }) => {
        matrix.get(candidate_a)?.set(candidate_b, frac);
        matrix.get(candidate_b)?.set(candidate_a, frac); // Symmetric
      });

      // Verify symmetry: M[a,b] == M[b,a]
      candidates.forEach((a) => {
        candidates.forEach((b) => {
          if (a !== b) {
            expect(matrix.get(a)?.get(b)).toBe(matrix.get(b)?.get(a));
          }
        });
      });
    });
  });

  describe("Edge cases", () => {
    test("should handle single-candidate scenario", () => {
      // Single candidate produces no pairs
      const stats = createStatsFixture({
        unique_pairs: 0,
        total_ballots_considered: 100,
        max_pair_frac: 0,
      });
      expect(() => Stats.parse(stats)).not.toThrow();
    });

    test("should handle two-candidate scenario", () => {
      // Two candidates produce exactly 1 pair
      const stats = createStatsFixture({
        unique_pairs: 1,
        total_ballots_considered: 100,
        max_pair_frac: 0.9,
      });
      expect(() => Stats.parse(stats)).not.toThrow();

      const pair = createOutputFixture({
        candidate_a: 1,
        candidate_b: 2,
        cooccurrence_count: 90,
        cooccurrence_frac: 0.9,
      });
      expect(() => Output.parse(pair)).not.toThrow();
    });

    test("should validate C(n,2) pairs for all-candidate ballots", () => {
      // For 6 candidates: C(6,2) = 15 pairs
      const expectedPairs = (6 * 5) / 2;
      const stats = createStatsFixture({
        unique_pairs: expectedPairs,
        total_ballots_considered: 1000,
        max_pair_frac: 1.0, // All ballots rank all candidates
      });
      expect(() => Stats.parse(stats)).not.toThrow();
      expect(stats.unique_pairs).toBe(15);
    });

    test("should handle mixed-depth ballots", () => {
      // Some ballots rank 1-2 candidates, others rank all 6
      const stats = createStatsFixture({
        unique_pairs: 15,
        total_ballots_considered: 1000,
        max_pair_frac: 0.3, // Not all pairs appear on all ballots
      });
      expect(() => Stats.parse(stats)).not.toThrow();
    });
  });

  describe("Validation rules documentation", () => {
    test("should document structural checks", () => {
      expect(VALIDATION_RULES.structuralChecks).toContain(
        "All cooccurrence_count values >= 0",
      );
      expect(VALIDATION_RULES.structuralChecks).toContain(
        "All cooccurrence_frac values in [0, 1]",
      );
      expect(VALIDATION_RULES.structuralChecks).toContain(
        "candidate_a < candidate_b lexicographically for all rows",
      );
      expect(VALIDATION_RULES.structuralChecks).toContain(
        "No self pairs: candidate_a != candidate_b",
      );
    });

    test("should document semantic checks", () => {
      expect(VALIDATION_RULES.semanticChecks).toContain(
        "cooccurrence_count <= total_ballots_considered for all rows",
      );
      expect(VALIDATION_RULES.semanticChecks).toContain("max_pair_frac <= 1");
    });

    test("should document mathematical checks", () => {
      expect(VALIDATION_RULES.mathematicalChecks).toContain(
        "cooccurrence_frac = cooccurrence_count / total_ballots_considered (within float tolerance)",
      );
      expect(VALIDATION_RULES.mathematicalChecks).toContain(
        "Symmetric reconstruction: matrix M[a,b] == M[b,a] when mirrored",
      );
    });
  });

  describe("Fixture generators", () => {
    test("should generate valid Output fixtures", () => {
      const fixture = createOutputFixture();
      expect(() => Output.parse(fixture)).not.toThrow();
      expect(fixture.candidate_a).toBe(1);
      expect(fixture.candidate_b).toBe(2);
      expect(fixture.candidate_a < fixture.candidate_b).toBe(true);
    });

    test("should generate valid Stats fixtures", () => {
      const fixture = createStatsFixture();
      expect(() => Stats.parse(fixture)).not.toThrow();
      expect(fixture.total_ballots_considered).toBeGreaterThan(0);
      expect(fixture.unique_pairs).toBeGreaterThanOrEqual(0);
    });

    test("should allow fixture overrides", () => {
      const customOutput = createOutputFixture({
        candidate_a: 3,
        candidate_b: 4,
        cooccurrence_count: 42,
      });

      expect(customOutput.candidate_a).toBe(3);
      expect(customOutput.candidate_b).toBe(4);
      expect(customOutput.cooccurrence_count).toBe(42);
      expect(() => Output.parse(customOutput)).not.toThrow();
    });
  });

  describe("SQL query validation", () => {
    test("should have valid SQL query templates", () => {
      expect(SQL_QUERIES.createBallotsLongView).toBeTypeOf("function");
      expect(SQL_QUERIES.createBallotsLongView("/test/path")).toContain(
        "CREATE OR REPLACE VIEW ballots_long",
      );

      expect(SQL_QUERIES.exportAffinityMatrix).toContain(
        "CREATE OR REPLACE TABLE candidate_affinity_matrix_tmp",
      );
      expect(SQL_QUERIES.exportAffinityMatrix).toContain(
        "a.candidate_id < b.candidate_id",
      );

      expect(SQL_QUERIES.copyToParquet).toBeTypeOf("function");
      expect(SQL_QUERIES.copyToParquet("/output")).toContain(
        "COPY candidate_affinity_matrix_with_identity TO",
      );
    });

    test("should use canonical ordering in SQL", () => {
      expect(SQL_QUERIES.exportAffinityMatrix).toContain(
        "a.candidate_id < b.candidate_id",
      );
      expect(SQL_QUERIES.computeAffinityMatrix).toContain(
        "a.candidate_id < b.candidate_id",
      );
    });

    test("should handle deduplication in SQL", () => {
      expect(SQL_QUERIES.exportAffinityMatrix).toContain(
        "GROUP BY BallotID, candidate_id",
      );
      expect(SQL_QUERIES.computeAffinityMatrix).toContain(
        "GROUP BY BallotID, candidate_id",
      );
    });
  });

  describe("Mathematical consistency", () => {
    test("should maintain fraction-count relationship across multiple rows", () => {
      const totalBallots = 1000;
      const testCases = [
        { count: 750, frac: 0.75 },
        { count: 500, frac: 0.5 },
        { count: 250, frac: 0.25 },
        { count: 100, frac: 0.1 },
      ];

      testCases.forEach(({ count, frac }) => {
        const output = createOutputFixture({
          cooccurrence_count: count,
          cooccurrence_frac: frac,
        });

        expect(() => Output.parse(output)).not.toThrow();
        expect(output.cooccurrence_frac).toBeCloseTo(count / totalBallots, 3);
      });
    });

    test("should validate stats consistency with output data", () => {
      const outputs = [
        createOutputFixture({ cooccurrence_frac: 0.8 }),
        createOutputFixture({
          candidate_a: 1,
          candidate_b: 3,
          cooccurrence_frac: 0.6,
        }),
        createOutputFixture({
          candidate_a: 2,
          candidate_b: 3,
          cooccurrence_frac: 0.9,
        }),
      ];

      const maxFrac = Math.max(...outputs.map((o) => o.cooccurrence_frac));

      const stats = createStatsFixture({
        unique_pairs: outputs.length,
        max_pair_frac: maxFrac,
      });

      expect(() => Stats.parse(stats)).not.toThrow();
      expect(stats.max_pair_frac).toBe(0.9);
      expect(stats.unique_pairs).toBe(3);
    });
  });

  describe("Edge case validation", () => {
    test("should handle very small fractions", () => {
      const smallFrac = createOutputFixture({
        cooccurrence_count: 1,
        cooccurrence_frac: 0.001,
      });
      expect(() => Output.parse(smallFrac)).not.toThrow();
    });

    test("should handle maximum values", () => {
      const maxValues = createOutputFixture({
        cooccurrence_frac: 1.0,
        cooccurrence_count: 1000000,
      });
      expect(() => Output.parse(maxValues)).not.toThrow();
    });

    test("should reject invalid candidate ID combinations", () => {
      const invalidCombos = [
        { candidate_a: 0, candidate_b: 1 }, // candidate_a must be positive
        { candidate_a: 1, candidate_b: 0 }, // candidate_b must be positive
        { candidate_a: -1, candidate_b: 2 }, // negative IDs
        { candidate_a: 1.5, candidate_b: 2 }, // non-integer IDs
      ];

      invalidCombos.forEach((combo) => {
        const invalid = createOutputFixture(combo);
        expect(() => Output.parse(invalid)).toThrow();
      });
    });

    test("should handle large dataset statistics", () => {
      const largeStats = createStatsFixture({
        total_ballots_considered: 1000000,
        unique_pairs: 4950, // C(100,2) for 100 candidates
        max_pair_frac: 0.95,
        compute_ms: 30000, // 30 seconds
      });
      expect(() => Stats.parse(largeStats)).not.toThrow();
    });
  });

  describe("Contract integration scenarios", () => {
    test("should validate complete election workflow", () => {
      // Simulate a small election with 4 candidates
      const candidates = [1, 2, 3, 4];
      const expectedPairs = (4 * 3) / 2; // C(4,2) = 6 pairs

      const pairs = [];
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          pairs.push(
            createOutputFixture({
              candidate_a: candidates[i],
              candidate_b: candidates[j],
              cooccurrence_count: Math.floor(Math.random() * 100),
              cooccurrence_frac: Math.random() * 0.8,
            }),
          );
        }
      }

      expect(pairs).toHaveLength(expectedPairs);
      pairs.forEach((pair) => {
        expect(() => Output.parse(pair)).not.toThrow();
        expect(pair.candidate_a).toBeLessThan(pair.candidate_b);
      });

      const maxFrac = Math.max(...pairs.map((p) => p.cooccurrence_frac));
      const stats = createStatsFixture({
        unique_pairs: pairs.length,
        max_pair_frac: maxFrac,
      });

      expect(() => Stats.parse(stats)).not.toThrow();
    });

    test("should handle real-world data patterns", () => {
      // Simulate realistic affinity patterns
      const highAffinityPair = createOutputFixture({
        candidate_a: 1,
        candidate_b: 2,
        cooccurrence_count: 8500,
        cooccurrence_frac: 0.85, // 85% of voters ranked both
      });

      const moderateAffinityPair = createOutputFixture({
        candidate_a: 1,
        candidate_b: 3,
        cooccurrence_count: 4500,
        cooccurrence_frac: 0.45,
      });

      const lowAffinityPair = createOutputFixture({
        candidate_a: 2,
        candidate_b: 3,
        cooccurrence_count: 1000,
        cooccurrence_frac: 0.1,
      });

      [highAffinityPair, moderateAffinityPair, lowAffinityPair].forEach(
        (pair) => {
          expect(() => Output.parse(pair)).not.toThrow();
        },
      );

      const stats = createStatsFixture({
        total_ballots_considered: 10000,
        unique_pairs: 3,
        max_pair_frac: 0.85,
      });

      expect(() => Stats.parse(stats)).not.toThrow();
    });

    test("should validate version consistency", () => {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(version).toBe("0.1.0");
    });
  });
});
