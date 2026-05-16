import { describe, expect, it } from "vitest";
import { formatTime, typeBadgeColor, maturityBadge, statusBadge, resultBadgeColor, resultLabel } from "../lib/ui-utils";

describe("ui-utils", () => {
  describe("formatTime", () => {
    it("formats ISO string to MM-DD HH:mm", () => {
      const result = formatTime("2026-05-15T14:30:00.000Z");
      expect(result).toMatch(/\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it("handles invalid date string gracefully", () => {
      const result = formatTime("not-a-date");
      expect(result).toBe("not-a-date");
      expect(result).not.toContain("NaN");
    });
  });

  describe("typeBadgeColor", () => {
    it("returns correct color for MethodCard", () => {
      expect(typeBadgeColor("MethodCard")).toBe("bg-blue-100 text-blue-800");
    });

    it("returns correct color for MisconceptionCard", () => {
      expect(typeBadgeColor("MisconceptionCard")).toBe("bg-red-100 text-red-800");
    });

    it("returns correct color for ReflectionCard", () => {
      expect(typeBadgeColor("ReflectionCard")).toBe("bg-purple-100 text-purple-800");
    });

    it("returns correct color for ConceptCard", () => {
      expect(typeBadgeColor("ConceptCard")).toBe("bg-green-100 text-green-800");
    });

    it("returns correct color for CaseCard", () => {
      expect(typeBadgeColor("CaseCard")).toBe("bg-yellow-100 text-yellow-800");
    });

    it("returns default color for unknown type", () => {
      expect(typeBadgeColor("Unknown")).toBe("bg-gray-100 text-gray-800");
    });
  });

  describe("maturityBadge", () => {
    it("returns correct badge for Ability", () => {
      expect(maturityBadge("Ability")).toBe("bg-emerald-100 text-emerald-800");
    });

    it("returns correct badge for Understanding", () => {
      expect(maturityBadge("Understanding")).toBe("bg-sky-100 text-sky-800");
    });

    it("returns default badge for Reference", () => {
      expect(maturityBadge("Reference")).toBe("bg-stone-100 text-stone-800");
    });
  });

  describe("statusBadge", () => {
    it("returns confirmed badge", () => {
      expect(statusBadge("confirmed")).toBe("bg-green-100 text-green-800");
    });

    it("returns draft badge for other status", () => {
      expect(statusBadge("draft")).toBe("bg-yellow-100 text-yellow-800");
    });
  });

  describe("resultBadgeColor", () => {
    it("returns moss color for good", () => {
      expect(resultBadgeColor("good")).toBe("bg-moss/15 text-moss");
    });

    it("returns yellow color for partial", () => {
      expect(resultBadgeColor("partial")).toBe("bg-yellow-100 text-yellow-700");
    });

    it("returns rust color for needs_work", () => {
      expect(resultBadgeColor("needs_work")).toBe("bg-rust/10 text-rust");
    });
  });

  describe("resultLabel", () => {
    it("returns correct label for good", () => {
      expect(resultLabel("good")).toBe("理解到位");
    });

    it("returns correct label for partial", () => {
      expect(resultLabel("partial")).toBe("部分理解");
    });

    it("returns correct label for needs_work", () => {
      expect(resultLabel("needs_work")).toBe("需要补充");
    });
  });
});
