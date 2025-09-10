import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("class1", "class2")).toContain("class1");
      expect(cn("class1", "class2")).toContain("class2");
    });

    it("should handle conditional classes", () => {
      expect(cn("class1", false && "class2", "class3")).toContain("class1");
      expect(cn("class1", false && "class2", "class3")).toContain("class3");
    });

    it("should handle undefined and null", () => {
      expect(cn("class1", null, undefined, "class2")).toContain("class1");
      expect(cn("class1", null, undefined, "class2")).toContain("class2");
    });

    it("should handle arrays", () => {
      expect(cn(["class1", "class2"])).toContain("class1");
      expect(cn(["class1", "class2"])).toContain("class2");
    });

    it("should handle objects", () => {
      expect(cn({ class1: true, class2: false })).toContain("class1");
      expect(cn({ class1: true, class2: false })).not.toContain("class2");
    });
  });
});
