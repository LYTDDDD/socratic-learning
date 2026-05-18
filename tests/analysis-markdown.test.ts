import { describe, expect, it } from "vitest";
import { buildMarkdownFromAnalysisJson } from "../lib/analysis-markdown";

describe("buildMarkdownFromAnalysisJson", () => {
  it("builds a readable markdown report from JSON-only analysis output", () => {
    const result = buildMarkdownFromAnalysisJson({
      mission_review: {
        original_goal: "复盘一次学习判断",
        final_judgment: "先校验证据，再沉淀资产",
        key_turning_points: [
          {
            turning_point: "发现原判断证据不足",
            evidence: "对话中多次要求补充例子",
            why_it_matters: "说明判断还没有稳定迁移",
          },
        ],
      },
      depth_evaluation: {
        overall_depth_score: 7,
        overall_reason: "出现了判断变化",
        dimension_scores: {
          judgment_shift: {
            score: 8,
            evidence: "从直接保存转向先验证",
            uncertainty: "",
          },
        },
      },
      asset_decision: {
        asset_candidate: true,
        recommended_asset_type: "MethodCard",
        recommended_maturity: "Reference",
        why_worth_saving: "能迁移到类似复盘任务",
        asset_candidate_package: {
          draft_asset: {
            title: "证据优先的复盘方法",
            core_insight: "资产入库前先看判断是否被证据改变",
            my_understanding_prompt: "用你自己的话改写这个判断。",
            review_questions: ["这次判断变化的证据是什么？"],
          },
        },
      },
      trace_summary: {
        mission_detected: true,
        key_evidence_used: ["用户要求只保留 JSON"],
      },
    });

    expect(result).toContain("# Offline Mission Analysis");
    expect(result).toContain("复盘一次学习判断");
    expect(result).toContain("证据优先的复盘方法");
    expect(result).toContain("这次判断变化的证据是什么？");
  });

  it("returns null for non-object input", () => {
    expect(buildMarkdownFromAnalysisJson(null)).toBeNull();
  });
});
