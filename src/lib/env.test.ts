import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EnvSchema,
  getArtifactRoot,
  getDataEnv,
  isDebug,
  isStaticBuild,
  isVerbose,
  validateEnv,
} from "./env";

describe("env", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("EnvSchema", () => {
    it("should parse valid environment", () => {
      const result = EnvSchema.parse({
        NODE_ENV: "development",
        DATA_ENV: "dev",
        DEBUG: "false",
        VERBOSE: "false",
        STATIC_BUILD: "false",
      });

      expect(result.NODE_ENV).toBe("development");
      expect(result.DATA_ENV).toBe("dev");
    });

    it("should use defaults for optional fields", () => {
      const result = EnvSchema.parse({});
      expect(result.NODE_ENV).toBe("development");
      expect(result.DATA_ENV).toBe("dev");
      expect(result.DEBUG).toBe("false");
    });
  });

  describe("validateEnv", () => {
    it("should validate successfully with good env", () => {
      const oldNodeEnv = process.env.NODE_ENV;
      const oldDataEnv = process.env.DATA_ENV;

      Object.assign(process.env, { NODE_ENV: "test", DATA_ENV: "test" });
      expect(() => validateEnv()).not.toThrow();

      Object.assign(process.env, {
        NODE_ENV: oldNodeEnv,
        DATA_ENV: oldDataEnv,
      });
    });

    it("should throw on invalid env", () => {
      const oldNodeEnv = process.env.NODE_ENV;

      Object.assign(process.env, { NODE_ENV: "invalid" });
      expect(() => validateEnv()).toThrow("Invalid environment configuration");

      Object.assign(process.env, { NODE_ENV: oldNodeEnv });
    });
  });

  describe("getDataEnv", () => {
    it("should return DATA_ENV from process.env", () => {
      process.env.DATA_ENV = "prod";
      expect(getDataEnv()).toBe("prod");
    });
  });

  describe("isDebug", () => {
    it("should return true for DEBUG=true", () => {
      process.env.DEBUG = "true";
      expect(isDebug()).toBe(true);
    });

    it("should return true for DEBUG=1", () => {
      process.env.DEBUG = "1";
      expect(isDebug()).toBe(true);
    });

    it("should return false for DEBUG=false", () => {
      process.env.DEBUG = "false";
      expect(isDebug()).toBe(false);
    });
  });

  describe("isVerbose", () => {
    it("should return true for VERBOSE=true", () => {
      process.env.VERBOSE = "true";
      expect(isVerbose()).toBe(true);
    });

    it("should return false for VERBOSE=false", () => {
      process.env.VERBOSE = "false";
      expect(isVerbose()).toBe(false);
    });
  });

  describe("getArtifactRoot", () => {
    it("should return correct path for env", () => {
      expect(getArtifactRoot("dev")).toBe("data/dev");
      expect(getArtifactRoot("prod")).toBe("data/prod");
    });
  });

  describe("isStaticBuild", () => {
    it("should return true for STATIC_BUILD=true", () => {
      process.env.STATIC_BUILD = "true";
      expect(isStaticBuild()).toBe(true);
    });

    it("should return false for STATIC_BUILD=false", () => {
      process.env.STATIC_BUILD = "false";
      expect(isStaticBuild()).toBe(false);
    });
  });
});
