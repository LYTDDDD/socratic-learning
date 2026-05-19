import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StructuredReportView } from "../components/StructuredReportView";
import type { CognitiveAsset } from "../lib/extract-asset";

function makeReportJson() {
  return {
    mission_review: {
      original_goal: "判断学生是否真正理解斜率",
      key_turning_points: [
        {
          turning_point: "从会算公式转向能解释意义",
          evidence: "学生能算出答案，但解释不出参数含义。",
          why_it_matters: "暴露了过程性掌握和概念理解的差异。",
        },
      ],
      misconceptions_or_hidden_assumptions: [
        {
          item: "把会做题等同于理解",
          type: "hidden_assumption",
          evidence: "只检查了公式应用。",
          correction: "增加解释与迁移问题。",
          uncertainty: "还缺少更多课堂样本。",
        },
      ],
      final_judgment: "以后评估理解时同时看计算、解释和迁移。",
      asset_candidate_suggestion: {
        suggested: true,
        reason: "形成了可迁移的诊断方法。",
      },
      asset_update_proposal: {
        suggested_action: "none",
        reason: "没有旧资产上下文。",
        evidence: [],
      },
      next_action: {
        action: "用三道迁移题测试该诊断方法。",
        verification_method: "比较学生解释质量。",
      },
    },
    depth_evaluation: {
      overall_depth_score: 7,
      overall_reason: "有明确判断变化。",
      dimension_scores: {
        judgment_shift: {
          score: 8,
          evidence: "从公式正确转向意义解释。",
          uncertainty: "",
        },
        transferability: {
          score: 6,
          evidence: "可迁移到其他概念诊断。",
          uncertainty: "还需要真实使用证据。",
        },
      },
      candidate_rule_check: {
        depth_score_gte_6: true,
        at_least_2_dimensions_with_evidence: true,
        qualified: true,
        reason: "满足候选阈值。",
      },
    },
    asset_decision: {
      asset_candidate: true,
      why_worth_saving: "可复用为课堂理解诊断方法。",
      recommended_asset_type: "MethodCard",
      recommended_maturity: "Reference",
      asset_candidate_package: {
        draft_asset: {
          title: "理解诊断三问",
          core_insight: "真正理解需要能解释意义并迁移。",
          ai_generated_summary: "AI 生成的候选方法。",
          my_understanding_prompt: "用你自己的话改写这个诊断方法。",
          problem_it_solves: "避免把会算误判成理解。",
          original_judgment: "会算就是理解。",
          revised_judgment: "能解释和迁移才更接近理解。",
          transferable_value: "可用于其他抽象概念教学。",
          usage_evidence_prompt: "下次课堂使用后记录学生回答。",
          review_questions: ["为什么会算不等于理解？"],
          connection_questions: ["它和你过去哪次误判有关？"],
          application_questions: ["下次讲函数时怎么使用？"],
          connection_layer: {
            related_concepts: ["概念理解"],
            related_assets: ["课堂诊断"],
            mental_models: ["证据链判断"],
            application_scenarios: ["数学课堂"],
          },
        },
      },
    },
    trace_summary: {
      mission_detected: true,
      analysis_path: ["识别目标", "评估判断变化"],
      key_evidence_used: ["学生解释不出参数含义"],
      policy_checks: ["未展示隐藏推理"],
      uncertainties: ["样本较少"],
    },
  };
}

function makeDraftAsset(): CognitiveAsset {
  return {
    asset_id: "asset_report_1",
    created_at: "2026-05-19T00:00:00.000Z",
    source_run_id: "run_report_1",
    status: "draft",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "理解诊断三问",
    ai_generated_summary: "",
    core_insight: "真正理解需要能解释意义并迁移。",
    my_understanding: "",
    problem_it_solves: "避免把会算误判成理解。",
    original_judgment: "会算就是理解。",
    revised_judgment: "能解释和迁移才更接近理解。",
    my_judgment: "",
    transferable_value: "可用于其他抽象概念教学。",
    review_questions: ["为什么会算不等于理解？"],
    source_mission: "",
    confidence: 0,
    special_fields: {},
    full_package: {},
    connection_questions: [],
    application_questions: [],
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    ai_suggested_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    connection_layer: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    current_version_id: "ver_report_1",
    versions: [
      {
        id: "ver_report_1",
        assetId: "asset_report_1",
        versionNumber: 1,
        title: "理解诊断三问",
        coreInsight: "真正理解需要能解释意义并迁移。",
        originalJudgment: "会算就是理解。",
        revisedJudgment: "能解释和迁移才更接近理解。",
        myUnderstanding: "",
        transferableValue: "可用于其他抽象概念教学。",
        createdAt: "2026-05-19T00:00:00.000Z",
      },
    ],
  };
}

describe("StructuredReportView", () => {
  it("renders the major JSON-only report sections", () => {
    render(<StructuredReportView json={makeReportJson()} parseStatus="success" />);

    expect(screen.getByText("离线任务分析报告")).toBeInTheDocument();
    expect(screen.getByText("任务复盘")).toBeInTheDocument();
    expect(screen.getByText("判断学生是否真正理解斜率")).toBeInTheDocument();
    expect(screen.getByText("Depth Evaluation")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("资产决策")).toBeInTheDocument();
    expect(screen.getByText("理解诊断三问")).toBeInTheDocument();
    expect(screen.getByText("为什么会算不等于理解？")).toBeInTheDocument();
    expect(screen.getByText("判断依据摘要")).toBeInTheDocument();
    expect(screen.getByText("学生解释不出参数含义")).toBeInTheDocument();
  });

  it("renders empty state before analysis", () => {
    render(<StructuredReportView json={null} parseStatus="not_attempted" />);

    expect(screen.getByText(/暂无结构化报告/)).toBeInTheDocument();
  });

  it("renders parse failure state", () => {
    render(<StructuredReportView json={{}} parseStatus="failed" />);

    expect(screen.getByText("JSON 解析失败，无法渲染结构化报告。")).toBeInTheDocument();
  });

  it("exposes asset candidate actions from the report", () => {
    const draftAsset = makeDraftAsset();
    const onConfirm = vi.fn();
    const onDiscard = vi.fn();
    render(
      <StructuredReportView
        draftAsset={draftAsset}
        json={makeReportJson()}
        onConfirmDraftAsset={onConfirm}
        onDiscardDraftAsset={onDiscard}
        parseStatus="success"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认入库" }));
    fireEvent.click(screen.getByRole("button", { name: "放弃候选" }));

    expect(onConfirm).toHaveBeenCalledWith(draftAsset);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("shows saved state for an already confirmed asset candidate", () => {
    render(
      <StructuredReportView
        assetAlreadySaved
        draftAsset={makeDraftAsset()}
        json={makeReportJson()}
        parseStatus="success"
      />,
    );

    expect(screen.getByText("已确认入库")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认入库" })).not.toBeInTheDocument();
  });

  it("shows discarded state for a dismissed asset candidate", () => {
    render(
      <StructuredReportView
        assetCandidateDismissed
        json={makeReportJson()}
        parseStatus="success"
      />,
    );

    expect(screen.getByText("已放弃候选")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认入库" })).not.toBeInTheDocument();
  });
});
