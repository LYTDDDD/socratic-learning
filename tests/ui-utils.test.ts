import { describe, expect, it } from "vitest";
import {
  feedbackMarkerBadge,
  feedbackMarkerLabel,
  feedbackSurfaceColor,
  formatTime,
  maturityBadge,
  resultBadgeColor,
  resultLabel,
  statusBadge,
  typeBadgeColor,
} from "../lib/ui-utils";

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
      expect(typeBadgeColor("MethodCard")).toBe("bg-blue/10 text-blue");
    });

    it("returns correct color for MisconceptionCard", () => {
      expect(typeBadgeColor("MisconceptionCard")).toBe("bg-red/10 text-red");
    });

    it("returns correct color for ReflectionCard", () => {
      expect(typeBadgeColor("ReflectionCard")).toBe("bg-surface-2 text-ink-muted");
    });

    it("returns correct color for ConceptCard", () => {
      expect(typeBadgeColor("ConceptCard")).toBe("bg-green/10 text-green");
    });

    it("returns correct color for CaseCard", () => {
      expect(typeBadgeColor("CaseCard")).toBe("bg-amber/10 text-amber");
    });

    it("returns default color for unknown type", () => {
      expect(typeBadgeColor("Unknown")).toBe("bg-surface-2 text-ink-muted");
    });
  });

  describe("maturityBadge", () => {
    it("returns correct badge for Ability", () => {
      expect(maturityBadge("Ability")).toBe("bg-green/10 text-green");
    });

    it("returns correct badge for Understanding", () => {
      expect(maturityBadge("Understanding")).toBe("bg-blue/10 text-blue");
    });

    it("returns default badge for Reference", () => {
      expect(maturityBadge("Reference")).toBe("bg-surface-2 text-ink-muted");
    });
  });

  describe("statusBadge", () => {
    it("returns confirmed badge", () => {
      expect(statusBadge("confirmed")).toBe("bg-green/10 text-green");
    });

    it("returns draft badge for other status", () => {
      expect(statusBadge("draft")).toBe("bg-amber/10 text-amber");
    });
  });

  describe("resultBadgeColor", () => {
    it("returns moss color for good", () => {
      expect(resultBadgeColor("good")).toBe("bg-green/15 text-green");
    });

    it("returns yellow color for partial", () => {
      expect(resultBadgeColor("partial")).toBe("bg-amber/10 text-amber");
    });

    it("returns rust color for needs_work", () => {
      expect(resultBadgeColor("needs_work")).toBe("bg-amber/10 text-amber");
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

  describe("feedbackSurfaceColor", () => {
    it("returns result surface colors", () => {
      expect(feedbackSurfaceColor("good")).toBe("border-green/30 bg-green/5");
      expect(feedbackSurfaceColor("partial")).toBe("border-amber/30 bg-amber/5");
      expect(feedbackSurfaceColor("needs_work")).toBe("border-amber/20 bg-amber/5");
    });
  });

  describe("feedbackMarkerBadge", () => {
    it("returns compact marker colors", () => {
      expect(feedbackMarkerBadge("good")).toBe("bg-green/10 text-green");
      expect(feedbackMarkerBadge("partial")).toBe("bg-amber/10 text-amber");
      expect(feedbackMarkerBadge("needs_work")).toBe("bg-amber/5 text-amber");
    });
  });

  describe("feedbackMarkerLabel", () => {
    it("returns compact marker labels", () => {
      expect(feedbackMarkerLabel("good")).toBe("✓");
      expect(feedbackMarkerLabel("partial")).toBe("◐");
      expect(feedbackMarkerLabel("needs_work")).toBe("✗");
    });
  });
});
