import { describe, expect, it } from "vitest";
import { diagnoseAnalysisJson, diagnosticLabel, diagnosticTone } from "../lib/analysis-schema-diagnostics";

function makeCompleteJson(): Record<string, unknown> {
  return {
    mission_review: {
      original_goal: "test",
      key_turning_points: [],
      final_judgment: "test",
    },
    depth_evaluation: {
      overall_depth_score: 7,
      dimension_scores: {},
    },
    asset_decision: {
      asset_candidate: false,
    },
    trace_summary: {
      mission_detected: true,
    },
  };
}

describe("diagnoseAnalysisJson", () => {
  it("returns failed for null input", () => {
    const result = diagnoseAnalysisJson(null);
    expect(result.level).toBe("failed");
    expect(result.presentPaths).toHaveLength(0);
    expect(result.missingPaths.length).toBeGreaterThan(0);
  });

  it("returns failed for non-object input", () => {
    expect(diagnoseAnalysisJson("string").level).toBe("failed");
    expect(diagnoseAnalysisJson(42).level).toBe("failed");
    expect(diagnoseAnalysisJson(true).level).toBe("failed");
  });

  it("returns complete for fully valid json", () => {
    const result = diagnoseAnalysisJson(makeCompleteJson());
    expect(result.level).toBe("complete");
    expect(result.missingPaths).toHaveLength(0);
  });

  it("returns partial when asset_decision is missing", () => {
    const json = makeCompleteJson();
    delete (json as Record<string, unknown>).asset_decision;
    const result = diagnoseAnalysisJson(json);
    expect(result.level).toBe("partial");
    expect(result.missingPaths).toContain("asset_decision");
    expect(result.missingPaths).toContain("asset_decision.asset_candidate");
    expect(result.presentPaths).toContain("mission_review");
  });

  it("returns partial when depth_evaluation is missing but mission_review exists", () => {
    const json = makeCompleteJson();
    delete (json as Record<string, unknown>).depth_evaluation;
    const result = diagnoseAnalysisJson(json);
    expect(result.level).toBe("partial");
    expect(result.presentPaths).toContain("mission_review");
    expect(result.missingPaths).toContain("depth_evaluation");
  });

  it("still renders mission_review when asset_decision is missing", () => {
    const json = makeCompleteJson();
    delete (json as Record<string, unknown>).asset_decision;
    const result = diagnoseAnalysisJson(json);
    expect(result.presentPaths).toContain("mission_review");
    expect(result.presentPaths).toContain("mission_review.original_goal");
    expect(result.presentPaths).toContain("depth_evaluation");
  });

  it("handles empty object", () => {
    const result = diagnoseAnalysisJson({});
    expect(result.level).toBe("failed");
    expect(result.missingPaths.length).toBeGreaterThan(0);
    expect(result.presentPaths).toHaveLength(0);
  });

  it("handles nested null values", () => {
    const json = { mission_review: null, depth_evaluation: null, asset_decision: null, trace_summary: null };
    const result = diagnoseAnalysisJson(json);
    expect(result.level).toBe("partial");
    expect(result.missingPaths).toContain("mission_review.original_goal");
  });
});

describe("diagnosticLabel", () => {
  it("returns correct labels", () => {
    expect(diagnosticLabel("complete")).toBe("完整");
    expect(diagnosticLabel("partial")).toBe("部分字段缺失");
    expect(diagnosticLabel("failed")).toBe("解析失败");
  });
});

describe("diagnosticTone", () => {
  it("returns correct tone classes", () => {
    expect(diagnosticTone("complete")).toContain("moss");
    expect(diagnosticTone("partial")).toContain("amber");
    expect(diagnosticTone("failed")).toContain("red");
  });
});
