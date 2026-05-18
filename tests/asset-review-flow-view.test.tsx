import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetReviewFlowView } from "../components/AssetReviewFlowView";
import type { CognitiveAsset } from "../lib/extract-asset";
import type { ReviewFlowState } from "../lib/use-asset-review";

afterEach(() => {
  cleanup();
});

function makeAsset(overrides: Partial<CognitiveAsset> = {}): CognitiveAsset {
  return {
    asset_id: "asset_test",
    title: "Test Asset",
    core_insight: "Core insight",
    original_judgment: "Original judgment",
    revised_judgment: "Revised judgment",
    my_understanding: "My understanding",
    transferable_value: "Transferable value",
    review_questions: [],
    connection_questions: [],
    application_questions: [],
    asset_type: "MethodCard",
    status: "confirmed",
    maturity: "Reference",
    confidence: 0.8,
    source_run_id: "run_1",
    source_mission: "",
    created_at: "2026-05-15T00:00:00.000Z",
    special_fields: {},
    connection_layer: {
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
    usage_evidence: [],
    ai_generated_summary: "",
    versions: [],
    current_version_id: "",
    problem_it_solves: "",
    my_judgment: "",
    full_package: {},
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    ai_generated_draft: {},
    user_final_asset: null,
    ...overrides,
  };
}

function renderView(reviewFlow: NonNullable<ReviewFlowState>) {
  const handlers = {
    onAnswerChange: vi.fn(),
    onExit: vi.fn(),
    onRetry: vi.fn(),
    onSubmit: vi.fn(),
  };

  render(
    <AssetReviewFlowView
      exitLabel="退出"
      onAnswerChange={handlers.onAnswerChange}
      onExit={handlers.onExit}
      onRetry={handlers.onRetry}
      onSubmit={handlers.onSubmit}
      reviewFlow={reviewFlow}
      title="复习评估"
    />,
  );

  return handlers;
}

describe("AssetReviewFlowView", () => {
  it("renders loading question state and exits", () => {
    const handlers = renderView({ phase: "loading_questions", asset: makeAsset() });

    expect(screen.getByText("Review Mode")).toBeInTheDocument();
    expect(screen.getByText("复习评估")).toBeInTheDocument();
    expect(screen.getByText("Test Asset")).toBeInTheDocument();
    expect(screen.getByText("AI 正在生成评估问题...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "退出" }));
    expect(handlers.onExit).toHaveBeenCalledTimes(1);
  });

  it("renders answering state and disables submit until every answer has content", () => {
    const handlers = renderView({
      phase: "answering",
      asset: makeAsset(),
      questions: ["Question 1?", "Question 2?"],
      answers: ["Answer 1", ""],
    });

    expect(screen.getByText("1. Question 1?")).toBeInTheDocument();
    expect(screen.getByText("2. Question 2?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交评估" })).toBeDisabled();

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Answer 2" } });
    expect(handlers.onAnswerChange).toHaveBeenCalledWith(1, "Answer 2");
  });

  it("renders result state with feedback, maturity suggestion, and custom actions", () => {
    render(
      <AssetReviewFlowView
        exitLabel="退出"
        onAnswerChange={vi.fn()}
        onExit={vi.fn()}
        onRetry={vi.fn()}
        onSubmit={vi.fn()}
        resultActions={<button type="button">返回复习面板</button>}
        reviewFlow={{
          phase: "result",
          asset: makeAsset(),
          feedback: [{ question: "Question?", answer: "Answer", evaluation: "good", comment: "Good job" }],
          overallAssessment: "Overall good",
          maturitySuggestion: { current: "Reference", suggested: "Understanding", reason: "Clear recall" },
          recordSaved: true,
        }}
        title="复习评估"
      />,
    );

    expect(screen.getByText("理解到位")).toBeInTheDocument();
    expect(screen.getByText("你的回答：Answer")).toBeInTheDocument();
    expect(screen.getByText("Overall good")).toBeInTheDocument();
    expect(screen.getByText("复习记录已保存。")).toBeInTheDocument();
    expect(screen.getByText("成熟度建议")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回复习面板" })).toBeInTheDocument();
  });

  it("renders error state and retries", () => {
    const handlers = renderView({ phase: "error", asset: makeAsset(), message: "Network error" });

    expect(screen.getByText("Review 出错")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });
});
