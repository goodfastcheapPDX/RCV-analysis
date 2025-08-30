import { describe, expect, it } from "vitest";
import { type ArtifactPaths, getArtifacts } from "./artifacts";
import type { DataEnv } from "./env";

const CANON_ELECTION = "portland-20241105-gen";
const CANON_CONTEST = "d2-3seat";

describe("getArtifacts", () => {
  describe("valid canonical election and contest", () => {
    it("should return correct artifact paths for dev environment", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "dev");

      expect(result).toEqual({
        firstChoiceParquet:
          "/data/dev/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
        stvTabulationParquet:
          "/data/dev/portland-20241105-gen/d2-3seat/stv/rounds.parquet",
        stvMetaParquet:
          "/data/dev/portland-20241105-gen/d2-3seat/stv/meta.parquet",
      });
    });

    it("should return correct artifact paths for test environment", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "test");

      expect(result).toEqual({
        firstChoiceParquet:
          "/data/test/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
        stvTabulationParquet:
          "/data/test/portland-20241105-gen/d2-3seat/stv/rounds.parquet",
        stvMetaParquet:
          "/data/test/portland-20241105-gen/d2-3seat/stv/meta.parquet",
      });
    });

    it("should return correct artifact paths for prod environment", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "prod");

      expect(result).toEqual({
        firstChoiceParquet:
          "/data/prod/portland-20241105-gen/d2-3seat/first_choice/first_choice.parquet",
        stvTabulationParquet:
          "/data/prod/portland-20241105-gen/d2-3seat/stv/rounds.parquet",
        stvMetaParquet:
          "/data/prod/portland-20241105-gen/d2-3seat/stv/meta.parquet",
      });
    });

    it("should return ArtifactPaths type with correct structure", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "dev");

      expect(typeof result.firstChoiceParquet).toBe("string");
      expect(typeof result.stvTabulationParquet).toBe("string");
      expect(typeof result.stvMetaParquet).toBe("string");
      expect(result.firstChoiceParquet).toBeDefined();
      expect(result.stvTabulationParquet).toBeDefined();
      expect(result.stvMetaParquet).toBeDefined();
    });

    it("should handle all valid DataEnv values consistently", () => {
      const envs: DataEnv[] = ["dev", "test", "prod"];

      envs.forEach((env) => {
        const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, env);
        expect(result.firstChoiceParquet?.startsWith(`/data/${env}/`)).toBe(
          true,
        );
        expect(result.stvTabulationParquet.startsWith(`/data/${env}/`)).toBe(
          true,
        );
        expect(result.stvMetaParquet.startsWith(`/data/${env}/`)).toBe(true);
      });
    });
  });

  describe("invalid election ID", () => {
    it("should throw error for invalid election ID with valid contest", () => {
      expect(() =>
        getArtifacts("invalid-election", CANON_CONTEST, "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should throw error for empty election ID", () => {
      expect(() => getArtifacts("", CANON_CONTEST, "dev")).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should throw error for similar but incorrect election ID", () => {
      expect(() =>
        getArtifacts("portland-2024-primary", CANON_CONTEST, "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should be case sensitive for election ID", () => {
      expect(() =>
        getArtifacts("Portland-2024-General", CANON_CONTEST, "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });
  });

  describe("invalid contest ID", () => {
    it("should throw error for invalid contest ID with valid election", () => {
      expect(() =>
        getArtifacts(CANON_ELECTION, "invalid-contest", "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should throw error for empty contest ID", () => {
      expect(() => getArtifacts(CANON_ELECTION, "", "dev")).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should throw error for similar but incorrect contest ID", () => {
      expect(() =>
        getArtifacts(CANON_ELECTION, "council-district-1", "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should be case sensitive for contest ID", () => {
      expect(() =>
        getArtifacts(CANON_ELECTION, "Council-District-2", "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });
  });

  describe("invalid election and contest combination", () => {
    it("should throw error when both election and contest are invalid", () => {
      expect(() =>
        getArtifacts("wrong-election", "wrong-contest", "dev"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=dev).`,
      );
    });

    it("should include environment in error message for different environments", () => {
      expect(() =>
        getArtifacts("wrong-election", "wrong-contest", "test"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=test).`,
      );

      expect(() =>
        getArtifacts("wrong-election", "wrong-contest", "prod"),
      ).toThrow(
        `Flat data layout only supports ${CANON_ELECTION}/${CANON_CONTEST} (env=prod).`,
      );
    });
  });

  describe("file path structure", () => {
    it("should generate paths with expected directory structure", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "dev");

      expect(result.firstChoiceParquet?.includes("/first_choice/")).toBe(true);
      expect(result.stvTabulationParquet.includes("/stv/")).toBe(true);
      expect(result.stvMetaParquet.includes("/stv/")).toBe(true);
    });

    it("should generate paths with .parquet extensions", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "dev");

      expect(result.firstChoiceParquet?.endsWith(".parquet")).toBe(true);
      expect(result.stvTabulationParquet.endsWith(".parquet")).toBe(true);
      expect(result.stvMetaParquet.endsWith(".parquet")).toBe(true);
    });

    it("should generate absolute paths", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "dev");

      expect(result.firstChoiceParquet?.startsWith("/")).toBe(true);
      expect(result.stvTabulationParquet.startsWith("/")).toBe(true);
      expect(result.stvMetaParquet.startsWith("/")).toBe(true);
    });
  });

  describe("type conformance", () => {
    it("should match ArtifactPaths interface", () => {
      const result: ArtifactPaths = getArtifacts(
        CANON_ELECTION,
        CANON_CONTEST,
        "dev",
      );

      // These checks ensure the type matches the interface
      expect("firstChoiceParquet" in result).toBe(true);
      expect("stvTabulationParquet" in result).toBe(true);
      expect("stvMetaParquet" in result).toBe(true);
    });

    it("should handle optional firstChoiceParquet field", () => {
      const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, "dev");

      // firstChoiceParquet is optional in the type but provided in current implementation
      expect(result.firstChoiceParquet).toBeDefined();

      // But the interface allows it to be undefined
      const paths: ArtifactPaths = {
        stvTabulationParquet: "/test/stv/stv_rounds.parquet",
        stvMetaParquet: "/test/stv/stv_meta.parquet",
      };
      expect(paths.firstChoiceParquet).toBeUndefined();
    });
  });

  describe("environment consistency", () => {
    it("should use consistent environment across all paths", () => {
      const testEnvs: DataEnv[] = ["dev", "test", "prod"];

      testEnvs.forEach((env) => {
        const result = getArtifacts(CANON_ELECTION, CANON_CONTEST, env);
        const expectedPrefix = `/data/${env}/`;

        expect(result.firstChoiceParquet?.startsWith(expectedPrefix)).toBe(
          true,
        );
        expect(result.stvTabulationParquet.startsWith(expectedPrefix)).toBe(
          true,
        );
        expect(result.stvMetaParquet.startsWith(expectedPrefix)).toBe(true);
      });
    });
  });
});
