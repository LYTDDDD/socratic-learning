import { describe, expect, it, vi, beforeEach } from "vitest";
import { runAgentPipeline, buildMultiAgentJson, buildMultiAgentMarkdown } from "../lib/agent-pipeline";
import type { AgentStep } from "../lib/agent-types";

vi.mock("../lib/llm", () => ({
  callReviewModel: vi.fn(),
}));

import { callReviewModel } from "../lib/llm";

const mockCallReviewModel = vi.mocked(callReviewModel);

function makeInput() {
  return {
    background: "test background",
    originalGoal: "test goal",
    conversation: "test conversation content",
    notes: "test notes",
    expectedOutput: "test expected output",
    preferenceRules: [],
  };
}

describe("runAgentPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs full pipeline when supervisor returns all steps", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "depth_evaluation", "asset", "curator", "reflection"],
          reasoning: "Full pipeline needed",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: ["d1"],
          turning_points: ["t1"],
          key_takeaways: ["k1"],
          summary: "review summary",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          depth_score: 7,
          blind_spots: ["b1"],
          improvement_directions: ["i1"],
          reasoning: "depth reasoning",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: true,
          asset_type: "principle",
          title: "Test Asset",
          core_insight: "insight",
          original_judgment: "orig",
          revised_judgment: "revised",
          my_understanding: "",
          transferable_value: "value",
          reasoning: "asset reasoning",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          connections: [{ source_concept: "a", target_concept: "b", connection_type: "因果", reasoning: "r" }],
          organization_tips: ["tip1"],
          suggested_tags: ["tag1"],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          reflection_questions: ["q1"],
          action_items: ["a1"],
          mindset_shifts: ["m1"],
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(6);
    expect(result.steps[0].agent).toBe("supervisor");
    expect(result.steps[0].status).toBe("success");
    expect(result.supervisorDecision).toBe("Full pipeline needed");

    const agentTypes = result.steps.map((s) => s.agent);
    expect(agentTypes).toEqual([
      "supervisor",
      "review",
      "depth_evaluation",
      "asset",
      "curator",
      "reflection",
    ]);

    for (const step of result.steps) {
      expect(step.status).toBe("success");
      expect(step.output).not.toBeNull();
      expect(step.startedAt).toBeTruthy();
      expect(step.finishedAt).toBeTruthy();
    }
  });

  it("runs partial pipeline when supervisor returns subset of steps", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "asset"],
          reasoning: "Short conversation",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "brief summary",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "no asset",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.agent)).toEqual(["supervisor", "review", "asset"]);
    expect(result.supervisorDecision).toBe("Short conversation");
  });

  it("falls back to default full pipeline when supervisor throws", async () => {
    mockCallReviewModel
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "fallback review",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          depth_score: 3,
          blind_spots: [],
          improvement_directions: [],
          reasoning: "fallback depth",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "no asset",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          connections: [],
          organization_tips: [],
          suggested_tags: [],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          reflection_questions: [],
          action_items: [],
          mindset_shifts: [],
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps[0].status).toBe("failed");
    expect(result.steps[0].error).toBe("API error");
    expect(result.supervisorDecision).toBe("Supervisor failed, using default full pipeline");
    expect(result.steps).toHaveLength(6);
  });

  it("skips unknown step types from supervisor output", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "unknown_step", "asset"],
          reasoning: "With unknown step",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "test",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "none",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.agent)).toEqual(["supervisor", "review", "asset"]);
  });

  it("skips supervisor step type if it appears in planned steps", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["supervisor", "review"],
          reasoning: "Should not re-run supervisor",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "test",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(2);
    expect(result.steps.map((s) => s.agent)).toEqual(["supervisor", "review"]);
  });

  it("marks individual agent step as failed when it throws", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "depth_evaluation"],
          reasoning: "Partial",
        }),
      )
      .mockRejectedValueOnce(new Error("Review API error"))
      .mockResolvedValueOnce(
        JSON.stringify({
          depth_score: 5,
          blind_spots: [],
          improvement_directions: [],
          reasoning: "test",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].agent).toBe("review");
    expect(result.steps[1].status).toBe("failed");
    expect(result.steps[2].agent).toBe("depth_evaluation");
    expect(result.steps[2].status).toBe("success");
  });

  it("uses default review+asset steps when supervisor output has no steps array", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({ reasoning: "No steps field" }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "test",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "none",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.agent)).toEqual(["supervisor", "review", "asset"]);
  });

  it("falls back to review+asset when supervisor returns empty steps array after filtering", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({ steps: ["unknown_type", "also_unknown"], reasoning: "bad steps" }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "fallback review",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "none",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.agent)).toEqual(["supervisor", "review", "asset"]);
  });

  it("passes input to supervisor execute", async () => {
    const input = makeInput();
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        steps: ["review"],
        reasoning: "test",
      }),
    );
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        key_decisions: [],
        turning_points: [],
        key_takeaways: [],
        summary: "test",
      }),
    );

    await runAgentPipeline(input);

    expect(mockCallReviewModel).toHaveBeenCalled();
    const firstCall = mockCallReviewModel.mock.calls[0];
    expect(firstCall[1]).toContain(input.originalGoal);
    expect(firstCall[1]).toContain(input.background);
  });
});

describe("buildMultiAgentJson", () => {
  it("builds JSON from successful steps only", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review"], reasoning: "test" },
        status: "success",
        error: null,
      },
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: null,
        status: "failed",
        error: "API error",
      },
      {
        agent: "depth_evaluation",
        startedAt: "2026-01-01T00:00:02Z",
        finishedAt: "2026-01-01T00:00:03Z",
        input: {},
        output: { depth_score: 7 },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);

    expect(result.supervisor).toEqual({ steps: ["review"], reasoning: "test" });
    expect(result.depth_evaluation).toEqual({ depth_score: 7 });
    expect(result).not.toHaveProperty("review");
    expect(result.trace_summary).toBeDefined();
  });

  it("includes trace_summary when steps exist even if all failed", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: null,
        status: "failed",
        error: "error",
      },
    ];

    const result = buildMultiAgentJson(steps);
    expect(result.trace_summary).toBeDefined();
    expect((result.trace_summary as Record<string, unknown>).mission_detected).toBe(true);
    expect((result.trace_summary as Record<string, unknown>).uncertainties).toEqual(["error"]);
  });

  it("returns empty object for empty steps array", () => {
    expect(buildMultiAgentJson([])).toEqual({});
  });

  it("adds mission_review compatibility key from review agent output", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          summary: "test summary",
          key_decisions: ["d1"],
          turning_points: ["t1"],
          key_takeaways: ["k1"],
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);

    expect(result.mission_review).toEqual({
      summary: "test summary",
      key_decisions: ["d1"],
      turning_points: ["t1"],
      key_takeaways: ["k1"],
    });
    expect(result.review).toEqual(result.mission_review);
  });

  it("does not add mission_review when review agent failed", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: null,
        status: "failed",
        error: "error",
      },
    ];

    const result = buildMultiAgentJson(steps);
    expect(result).not.toHaveProperty("mission_review");
  });

  it("adds asset_decision compatibility key from asset agent output", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "Test Title",
          core_insight: "insight",
          original_judgment: "orig",
          revised_judgment: "revised",
          my_understanding: "understanding",
          transferable_value: "value",
          reasoning: "reason",
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);

    expect(result.asset_decision).toEqual({
      asset_candidate: true,
      recommended_asset_type: "principle",
      title: "Test Title",
      core_insight: "insight",
      original_judgment: "orig",
      revised_judgment: "revised",
      my_understanding: "understanding",
      transferable_value: "value",
      reasoning: "reason",
      asset_candidate_package: {
        summary: "insight",
        judgment_change: {
          before: "orig",
          after: "revised",
          trigger: "",
        },
        draft_asset: {
          title: "Test Title",
          core_insight: "insight",
          original_judgment: "orig",
          revised_judgment: "revised",
          my_understanding: "understanding",
          transferable_value: "value",
          type: "principle",
        },
      },
    });
    expect(result.asset).toBeDefined();
  });

  it("maps has_asset false to asset_candidate false in asset_decision", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "none",
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    expect(decision.asset_candidate).toBe(false);
    expect(decision.recommended_asset_type).toBe("");
    expect(decision.asset_candidate_package).toBeNull();
  });

  it("does not add asset_decision when asset agent failed", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: null,
        status: "failed",
        error: "error",
      },
    ];

    const result = buildMultiAgentJson(steps);
    expect(result).not.toHaveProperty("asset_decision");
  });

  it("builds trace_summary with pipeline metadata", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review", "asset"], reasoning: "supervisor reason" },
        status: "success",
        error: null,
      },
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: { summary: "s" },
        status: "success",
        error: null,
      },
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:02Z",
        finishedAt: "2026-01-01T00:00:03Z",
        input: {},
        output: { has_asset: false, asset_type: "", title: "", core_insight: "", original_judgment: "", revised_judgment: "", my_understanding: "", transferable_value: "", reasoning: "" },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const ts = result.trace_summary as Record<string, unknown>;

    expect(ts.mission_detected).toBe(true);
    expect(ts.analysis_path).toBe("review → asset");
    expect(ts.key_evidence_used).toBe("supervisor reason");
    expect(ts.policy_checks).toBe("无偏好规则");
    expect(ts.uncertainties).toEqual([]);
  });

  it("includes preference rules count in trace_summary policy_checks", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: { input: { preferenceRules: ["rule1", "rule2", "rule3"] } },
        output: { steps: ["review"], reasoning: "test" },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const ts = result.trace_summary as Record<string, unknown>;
    expect(ts.policy_checks).toBe("已应用 3 条偏好规则");
  });

  it("collects failed step errors in trace_summary uncertainties", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review"], reasoning: "test" },
        status: "success",
        error: null,
      },
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: null,
        status: "failed",
        error: "Review timeout",
      },
      {
        agent: "depth_evaluation",
        startedAt: "2026-01-01T00:00:02Z",
        finishedAt: "2026-01-01T00:00:03Z",
        input: {},
        output: null,
        status: "failed",
        error: "Depth API error",
      },
    ];

    const result = buildMultiAgentJson(steps);
    const ts = result.trace_summary as Record<string, unknown>;
    expect(ts.uncertainties).toEqual(["Review timeout", "Depth API error"]);
    expect(ts.analysis_path).toBe("");
  });

  it("uses empty string for key_evidence_used when supervisor failed", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: null,
        status: "failed",
        error: "error",
      },
    ];

    const result = buildMultiAgentJson(steps);
    const ts = result.trace_summary as Record<string, unknown>;
    expect(ts.key_evidence_used).toBe("");
  });
});

describe("buildMultiAgentMarkdown", () => {
  it("builds markdown with supervisor section", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review", "asset"], reasoning: "Brief conversation" },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## SupervisorAgent");
    expect(md).toContain("编排决策");
    expect(md).toContain("Brief conversation");
    expect(md).toContain("review → asset");
  });

  it("builds markdown with review section", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          summary: "Test summary",
          key_decisions: ["dec1"],
          turning_points: ["tp1"],
          key_takeaways: ["kt1"],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## ReviewAgent");
    expect(md).toContain("Test summary");
    expect(md).toContain("关键决策");
    expect(md).toContain("dec1");
    expect(md).toContain("转折点");
    expect(md).toContain("tp1");
    expect(md).toContain("核心收获");
    expect(md).toContain("kt1");
  });

  it("builds markdown with depth_evaluation section", () => {
    const steps: AgentStep[] = [
      {
        agent: "depth_evaluation",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          depth_score: 8,
          blind_spots: ["blind1"],
          improvement_directions: ["imp1"],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## DepthEvaluationAgent");
    expect(md).toContain("8/10");
    expect(md).toContain("盲点");
    expect(md).toContain("blind1");
    expect(md).toContain("改进方向");
    expect(md).toContain("imp1");
  });

  it("builds markdown with asset section when has_asset is true", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "Test Principle",
          core_insight: "Core insight",
          transferable_value: "Transferable",
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## AssetAgent");
    expect(md).toContain("是");
    expect(md).toContain("principle");
    expect(md).toContain("Test Principle");
    expect(md).toContain("Core insight");
    expect(md).toContain("Transferable");
  });

  it("builds markdown with asset section when has_asset is false", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { has_asset: false },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("否");
    expect(md).not.toContain("资产类型");
  });

  it("builds markdown with curator section", () => {
    const steps: AgentStep[] = [
      {
        agent: "curator",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          connections: [
            { source_concept: "A", target_concept: "B", connection_type: "因果", reasoning: "r" },
          ],
          organization_tips: ["tip1"],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## CuratorAgent");
    expect(md).toContain("A → B");
    expect(md).toContain("因果");
    expect(md).toContain("关联建议");
    expect(md).toContain("整理建议");
    expect(md).toContain("tip1");
  });

  it("builds markdown with reflection section", () => {
    const steps: AgentStep[] = [
      {
        agent: "reflection",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          reflection_questions: ["q1"],
          action_items: ["a1"],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## ReflectionAgent");
    expect(md).toContain("反思问题");
    expect(md).toContain("q1");
    expect(md).toContain("行动建议");
    expect(md).toContain("a1");
  });

  it("includes Trace Summary section when steps exist", () => {
    const steps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review"], reasoning: "test reasoning" },
        status: "success",
        error: null,
      },
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: { summary: "s" },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## Trace Summary（轨迹摘要）");
    expect(md).toContain("是否识别到任务");
    expect(md).toContain("分析路径");
    expect(md).toContain("review");
    expect(md).toContain("关键证据");
    expect(md).toContain("test reasoning");
    expect(md).toContain("策略检查");
    expect(md).toContain("不确定性");
  });

  it("shows failed step errors in Trace Summary uncertainties", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: null,
        status: "failed",
        error: "Timeout",
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## Trace Summary（轨迹摘要）");
    expect(md).toContain("Timeout");
  });

  it("includes Trace Summary even when all steps failed", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: null,
        status: "failed",
        error: "error",
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("## Trace Summary（轨迹摘要）");
  });

  it("returns empty string for empty steps", () => {
    expect(buildMultiAgentMarkdown([])).toBe("");
  });
});
