import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type DataEnv, getArtifactRoot, getDataEnv } from "./env";

describe("getDataEnv", () => {
  const originalEnv = process.env.DATA_ENV;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DATA_ENV = originalEnv;
    } else {
      delete process.env.DATA_ENV;
    }
  });

  it("should return 'dev' when DATA_ENV is not set", () => {
    delete process.env.DATA_ENV;
    const result = getDataEnv();
    expect(result).toBe("dev");
  });

  it("should return 'dev' when DATA_ENV is set to 'dev'", () => {
    process.env.DATA_ENV = "dev";
    const result = getDataEnv();
    expect(result).toBe("dev");
  });

  it("should return 'test' when DATA_ENV is set to 'test'", () => {
    process.env.DATA_ENV = "test";
    const result = getDataEnv();
    expect(result).toBe("test");
  });

  it("should return 'prod' when DATA_ENV is set to 'prod'", () => {
    process.env.DATA_ENV = "prod";
    const result = getDataEnv();
    expect(result).toBe("prod");
  });

  it("should throw error for invalid DATA_ENV values", () => {
    process.env.DATA_ENV = "staging";
    expect(() => getDataEnv()).toThrow();
  });

  it("should throw error for empty string DATA_ENV", () => {
    process.env.DATA_ENV = "";
    expect(() => getDataEnv()).toThrow();
  });

  it("should throw error for numeric DATA_ENV", () => {
    process.env.DATA_ENV = "123";
    expect(() => getDataEnv()).toThrow();
  });

  it("should be case sensitive", () => {
    process.env.DATA_ENV = "DEV";
    expect(() => getDataEnv()).toThrow();
  });

  it("should reject DATA_ENV with whitespace", () => {
    process.env.DATA_ENV = " dev ";
    expect(() => getDataEnv()).toThrow();
  });

  it("should handle undefined environment variable gracefully", () => {
    // When setting to undefined in Node.js, it actually deletes the property
    delete process.env.DATA_ENV;
    const result = getDataEnv();
    expect(result).toBe("dev");
  });
});

describe("getArtifactRoot", () => {
  it("should return correct path for 'dev' environment", () => {
    const result = getArtifactRoot("dev");
    expect(result).toBe("/data/dev");
  });

  it("should return correct path for 'test' environment", () => {
    const result = getArtifactRoot("test");
    expect(result).toBe("/data/test");
  });

  it("should return correct path for 'prod' environment", () => {
    const result = getArtifactRoot("prod");
    expect(result).toBe("/data/prod");
  });

  it("should construct paths consistently", () => {
    const envs: DataEnv[] = ["dev", "test", "prod"];
    const results = envs.map((env) => getArtifactRoot(env));

    expect(results).toEqual(["/data/dev", "/data/test", "/data/prod"]);
  });

  it("should return string type", () => {
    const result = getArtifactRoot("dev");
    expect(typeof result).toBe("string");
  });

  it("should handle all valid DataEnv values", () => {
    const validEnvs: DataEnv[] = ["dev", "test", "prod"];

    validEnvs.forEach((env) => {
      const result = getArtifactRoot(env);
      expect(result).toBe(`/data/${env}`);
      expect(result.startsWith("/data/")).toBe(true);
    });
  });
});

describe("DataEnv type integration", () => {
  it("should work with getDataEnv output as getArtifactRoot input", () => {
    delete process.env.DATA_ENV;
    const env = getDataEnv();
    const root = getArtifactRoot(env);
    expect(root).toBe("/data/dev");
  });

  it("should work with all valid environment values", () => {
    const testCases: Array<{ envVar: string; expected: string }> = [
      { envVar: "dev", expected: "/data/dev" },
      { envVar: "test", expected: "/data/test" },
      { envVar: "prod", expected: "/data/prod" },
    ];

    testCases.forEach(({ envVar, expected }) => {
      process.env.DATA_ENV = envVar;
      const env = getDataEnv();
      const root = getArtifactRoot(env);
      expect(root).toBe(expected);
    });
  });
});
