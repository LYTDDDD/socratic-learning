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

function makeAllDimensions(score: number) {
  return {
    judgment_shift: { score, evidence: "test", uncertainty: "medium" as const },
    boundary_clarity: { score, evidence: "test", uncertainty: "medium" as const },
    transferability: { score, evidence: "test", uncertainty: "medium" as const },
    hidden_assumption: { score, evidence: "test", uncertainty: "medium" as const },
    counterexample_awareness: { score, evidence: "test", uncertainty: "medium" as const },
    framework_formation: { score, evidence: "test", uncertainty: "medium" as const },
    behavior_impact: { score, evidence: "test", uncertainty: "medium" as const },
  };
}

describe("runAgentPipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
          turning_points: [{ turning_point: "t1", evidence: "", why_it_matters: "" }],
          key_takeaways: ["k1"],
          summary: "review summary",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          depth_score: 7,
          dimensions: makeAllDimensions(7),
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
          dimensions: makeAllDimensions(3),
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
          dimensions: makeAllDimensions(5),
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

  it("skips AssetAgent LLM call when depth score < 6 and no blind_spots", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "depth_evaluation", "asset"],
          reasoning: "test",
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
          depth_score: 3,
          dimensions: makeAllDimensions(3),
          blind_spots: [],
          improvement_directions: ["improve"],
          reasoning: "shallow",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(4);
    const assetStep = result.steps.find((s) => s.agent === "asset");
    expect(assetStep).toBeDefined();
    expect(assetStep!.status).toBe("success");
    expect(assetStep!.output!.has_asset).toBe(false);
    expect(assetStep!.output!.reasoning).toContain("低于门槛");
    expect(mockCallReviewModel).toHaveBeenCalledTimes(3);
  });

  it("runs AssetAgent when depth score >= 6", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "depth_evaluation", "asset"],
          reasoning: "test",
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
          depth_score: 7,
          dimensions: makeAllDimensions(7),
          blind_spots: [],
          improvement_directions: ["improve"],
          reasoning: "deep",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: true,
          asset_type: "principle",
          title: "Test",
          core_insight: "insight",
          original_judgment: "orig",
          revised_judgment: "revised",
          my_understanding: "",
          transferable_value: "value",
          reasoning: "worth it",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(mockCallReviewModel).toHaveBeenCalledTimes(4);
    const assetStep = result.steps.find((s) => s.agent === "asset");
    expect(assetStep!.output!.has_asset).toBe(true);
  });

  it("runs AssetAgent when depth score < 6 but has blind_spots", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "depth_evaluation", "asset"],
          reasoning: "test",
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
          depth_score: 4,
          dimensions: makeAllDimensions(4),
          blind_spots: ["blind1"],
          improvement_directions: ["improve"],
          reasoning: "has evidence",
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

    expect(mockCallReviewModel).toHaveBeenCalledTimes(4);
    const assetStep = result.steps.find((s) => s.agent === "asset");
    expect(assetStep!.status).toBe("success");
  });

  it("runs AssetAgent normally when no depth_evaluation step exists", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "asset"],
          reasoning: "test",
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
          reasoning: "no asset",
        }),
      );

    const result = await runAgentPipeline(makeInput());

    expect(mockCallReviewModel).toHaveBeenCalledTimes(3);
    const assetStep = result.steps.find((s) => s.agent === "asset");
    expect(assetStep!.status).toBe("success");
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
        output: { depth_score: 7, dimensions: makeAllDimensions(7) },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);

    expect(result.supervisor).toEqual({ steps: ["review"], reasoning: "test" });
    expect(result.depth_evaluation).toEqual({ depth_score: 7, dimensions: makeAllDimensions(7) });
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
          turning_points: [{ turning_point: "t1", evidence: "", why_it_matters: "" }],
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
      turning_points: [{ turning_point: "t1", evidence: "", why_it_matters: "" }],
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
      recommended_asset_type: "ConceptCard",
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
          type: "ConceptCard",
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

  it("maps asset_type principle to ConceptCard", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "T",
          core_insight: "ci",
          original_judgment: "oj",
          revised_judgment: "rj",
          my_understanding: "mu",
          transferable_value: "tv",
          reasoning: "r",
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    expect(decision.recommended_asset_type).toBe("ConceptCard");
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;
    expect(draft.type).toBe("ConceptCard");
  });

  it("maps asset_type checklist to MethodCard", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "checklist",
          title: "T",
          core_insight: "ci",
          original_judgment: "oj",
          revised_judgment: "rj",
          my_understanding: "mu",
          transferable_value: "tv",
          reasoning: "r",
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    expect(decision.recommended_asset_type).toBe("MethodCard");
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;
    expect(draft.type).toBe("MethodCard");
  });

  it("maps asset_type insight to ReflectionCard", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "insight",
          title: "T",
          core_insight: "ci",
          original_judgment: "oj",
          revised_judgment: "rj",
          my_understanding: "mu",
          transferable_value: "tv",
          reasoning: "r",
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    expect(decision.recommended_asset_type).toBe("ReflectionCard");
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;
    expect(draft.type).toBe("ReflectionCard");
  });

  it("falls back unknown asset_type to ConceptCard", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "unknown_type",
          title: "T",
          core_insight: "ci",
          original_judgment: "oj",
          revised_judgment: "rj",
          my_understanding: "mu",
          transferable_value: "tv",
          reasoning: "r",
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    expect(decision.recommended_asset_type).toBe("ConceptCard");
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;
    expect(draft.type).toBe("ConceptCard");
  });

  it("returns empty string for recommended_asset_type when asset_type is empty", () => {
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
    expect(decision.recommended_asset_type).toBe("");
  });

  it("injects curator connections into draft_asset ai_suggested_connections and connection_layer", () => {
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
      {
        agent: "curator",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
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

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;

    expect(draft.ai_suggested_connections).toEqual({
      related_concepts: ["B"],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    });
    expect(draft.connection_layer).toEqual(draft.ai_suggested_connections);
  });

  it("does not add ai_suggested_connections when no curator step exists", () => {
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
    const decision = result.asset_decision as Record<string, unknown>;
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;

    expect(draft).not.toHaveProperty("ai_suggested_connections");
    expect(draft).not.toHaveProperty("connection_layer");
  });

  it("does not add ai_suggested_connections when curator step failed", () => {
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
      {
        agent: "curator",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: null,
        status: "failed",
        error: "Curator failed",
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;

    expect(draft).not.toHaveProperty("ai_suggested_connections");
    expect(draft).not.toHaveProperty("connection_layer");
  });

  it("maps curator connection_type to correct ConnectionLayer fields", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "Test",
          core_insight: "insight",
          original_judgment: "orig",
          revised_judgment: "revised",
          my_understanding: "",
          transferable_value: "value",
          reasoning: "",
        },
        status: "success",
        error: null,
      },
      {
        agent: "curator",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: {
          connections: [
            { source_concept: "a", target_concept: "concept1", connection_type: "concept_relation", reasoning: "" },
            { source_concept: "b", target_concept: "model1", connection_type: "mental_model", reasoning: "" },
            { source_concept: "c", target_concept: "exp1", connection_type: "experience", reasoning: "" },
            { source_concept: "d", target_concept: "opp1", connection_type: "opposite_case", reasoning: "" },
            { source_concept: "e", target_concept: "app1", connection_type: "application", reasoning: "" },
            { source_concept: "f", target_concept: "q1", connection_type: "question", reasoning: "" },
            { source_concept: "g", target_concept: "default1", connection_type: "因果", reasoning: "" },
          ],
          organization_tips: [],
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;
    const conn = draft.ai_suggested_connections as Record<string, string[]>;

    expect(conn.related_concepts).toEqual(["concept1", "default1"]);
    expect(conn.mental_models).toEqual(["model1"]);
    expect(conn.prior_experience).toEqual(["exp1"]);
    expect(conn.opposite_cases).toEqual(["opp1"]);
    expect(conn.application_scenarios).toEqual(["app1"]);
    expect(conn.open_questions).toEqual(["q1"]);
  });

  it("maps Chinese connection_type from CuratorAgent output", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "Test",
          core_insight: "insight",
          original_judgment: "orig",
          revised_judgment: "revised",
          my_understanding: "",
          transferable_value: "value",
          reasoning: "",
        },
        status: "success",
        error: null,
      },
      {
        agent: "curator",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: {
          connections: [
            { source_concept: "a", target_concept: "因果1", connection_type: "因果", reasoning: "" },
            { source_concept: "b", target_concept: "类比1", connection_type: "类比", reasoning: "" },
            { source_concept: "c", target_concept: "对比1", connection_type: "对比", reasoning: "" },
            { source_concept: "d", target_concept: "层级1", connection_type: "层级", reasoning: "" },
            { source_concept: "e", target_concept: "时序1", connection_type: "时序", reasoning: "" },
            { source_concept: "f", target_concept: "应用1", connection_type: "应用", reasoning: "" },
            { source_concept: "g", target_concept: "问题1", connection_type: "问题", reasoning: "" },
          ],
          organization_tips: [],
        },
        status: "success",
        error: null,
      },
    ];

    const result = buildMultiAgentJson(steps);
    const decision = result.asset_decision as Record<string, unknown>;
    const pkg = decision.asset_candidate_package as Record<string, unknown>;
    const draft = pkg.draft_asset as Record<string, unknown>;
    const conn = draft.ai_suggested_connections as Record<string, string[]>;

    expect(conn.related_concepts).toEqual(["因果1", "层级1"]);
    expect(conn.mental_models).toEqual(["类比1"]);
    expect(conn.opposite_cases).toEqual(["对比1"]);
    expect(conn.prior_experience).toEqual(["时序1"]);
    expect(conn.application_scenarios).toEqual(["应用1"]);
    expect(conn.open_questions).toEqual(["问题1"]);
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
          turning_points: [{ turning_point: "tp1", evidence: "", why_it_matters: "" }],
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
    expect(md).toContain("关键转折");
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
          dimensions: makeAllDimensions(8),
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
    expect(md).toContain("ConceptCard");
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

  it("adds AI suggested connections subsection in asset markdown when curator has connections", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "Test",
          core_insight: "insight",
          transferable_value: "value",
        },
        status: "success",
        error: null,
      },
      {
        agent: "curator",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: {
          connections: [
            { source_concept: "A", target_concept: "B", connection_type: "concept", reasoning: "r" },
            { source_concept: "C", target_concept: "D", connection_type: "model", reasoning: "r" },
          ],
          organization_tips: [],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("### AI 建议连接");
    expect(md).toContain("相关概念");
    expect(md).toContain("B");
    expect(md).toContain("心智模型");
    expect(md).toContain("D");
  });

  it("does not add AI suggested connections subsection when no curator connections", () => {
    const steps: AgentStep[] = [
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          has_asset: true,
          asset_type: "principle",
          title: "Test",
          core_insight: "insight",
          transferable_value: "value",
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).not.toContain("### AI 建议连接");
  });

  it("builds markdown with misconceptions in review section", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          summary: "test",
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          misconceptions: [
            { item: "误区1", type: "misconception", evidence: "证据1", correction: "纠正1" },
            { item: "假设1", type: "hidden_assumption", evidence: "证据2", correction: "纠正2" },
            { item: "探索1", type: "exploratory_thinking", evidence: "证据3", correction: "" },
          ],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("### 误区与隐藏假设");
    expect(md).toContain("**[误区]** 误区1");
    expect(md).toContain("证据：证据1");
    expect(md).toContain("纠正：纠正1");
    expect(md).toContain("**[隐藏假设]** 假设1");
    expect(md).toContain("**[探索性思考]** 探索1");
  });

  it("builds markdown with structured turning_points including evidence and significance", () => {
    const steps: AgentStep[] = [
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: {
          summary: "test",
          key_decisions: [],
          turning_points: [
            { turning_point: "从A转向B", evidence: "对话第3轮", why_it_matters: "改变了整体方向" },
          ],
          key_takeaways: [],
        },
        status: "success",
        error: null,
      },
    ];

    const md = buildMultiAgentMarkdown(steps);
    expect(md).toContain("### 关键转折");
    expect(md).toContain("**转折1**：从A转向B");
    expect(md).toContain("证据：对话第3轮");
    expect(md).toContain("意义：改变了整体方向");
  });
});

describe("runAgentPipeline callbacks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls onStepStart and onStepComplete for each agent", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "asset"],
          reasoning: "test",
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

    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();
    const onStepError = vi.fn();

    await runAgentPipeline(makeInput(), {
      onStepStart,
      onStepComplete,
      onStepError,
    });

    expect(onStepStart).toHaveBeenCalledTimes(3);
    expect(onStepStart).toHaveBeenCalledWith("supervisor", 0, 0);
    expect(onStepStart).toHaveBeenCalledWith("review", 1, 2);
    expect(onStepStart).toHaveBeenCalledWith("asset", 2, 2);

    expect(onStepComplete).toHaveBeenCalledTimes(3);
    expect(onStepComplete).toHaveBeenCalledWith("supervisor", 0, 0, expect.any(Number));
    expect(onStepComplete).toHaveBeenCalledWith("review", 1, 2, expect.any(Number));
    expect(onStepComplete).toHaveBeenCalledWith("asset", 2, 2, expect.any(Number));

    expect(onStepError).not.toHaveBeenCalled();
  });

  it("calls onStepError when an agent fails", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "asset"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Review failed"))
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

    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();
    const onStepError = vi.fn();

    await runAgentPipeline(makeInput(), {
      onStepStart,
      onStepComplete,
      onStepError,
    });

    expect(onStepError).toHaveBeenCalledWith("review", 1, 2, "Review failed");
    expect(onStepComplete).toHaveBeenCalledWith("supervisor", 0, 0, expect.any(Number));
    expect(onStepComplete).toHaveBeenCalledWith("asset", 2, 2, expect.any(Number));
  });

  it("calls onStepError when supervisor fails", async () => {
    mockCallReviewModel
      .mockRejectedValueOnce(new Error("Supervisor down"))
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

    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();
    const onStepError = vi.fn();

    await runAgentPipeline(makeInput(), {
      onStepStart,
      onStepComplete,
      onStepError,
    });

    expect(onStepError).toHaveBeenCalledWith("supervisor", 0, 0, "Supervisor down");
  });

  it("works without callbacks (backward compatible)", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
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
    expect(result.steps[0].status).toBe("success");
    expect(result.steps[1].status).toBe("success");
  });

  it("reports correct total based on planned steps", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review", "depth_evaluation", "asset"],
          reasoning: "3 steps",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ summary: "s", key_decisions: [], turning_points: [], key_takeaways: [] }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ depth_score: 7, dimensions: makeAllDimensions(7), blind_spots: [], improvement_directions: [] }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          has_asset: false, asset_type: "", title: "", core_insight: "",
          original_judgment: "", revised_judgment: "", my_understanding: "",
          transferable_value: "", reasoning: "",
        }),
      );

    const onStepStart = vi.fn();
    await runAgentPipeline(makeInput(), { onStepStart });

    expect(onStepStart).toHaveBeenCalledWith("supervisor", 0, 0);
    expect(onStepStart).toHaveBeenCalledWith("review", 1, 3);
    expect(onStepStart).toHaveBeenCalledWith("depth_evaluation", 2, 3);
    expect(onStepStart).toHaveBeenCalledWith("asset", 3, 3);
  });
});

describe("runAgentPipeline retry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("retries once by default and marks step as failed when all attempts fail", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Review API error"))
      .mockRejectedValueOnce(new Error("Review API error"));

    const result = await runAgentPipeline(makeInput(), undefined, { maxRetries: 1, retryDelayMs: 0 });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].agent).toBe("review");
    expect(result.steps[1].status).toBe("failed");
    expect(result.steps[1].error).toBe("Review API error");
  });

  it("retries with custom maxRetries=2", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Error 1"))
      .mockRejectedValueOnce(new Error("Error 2"))
      .mockRejectedValueOnce(new Error("Error 3"));

    const result = await runAgentPipeline(makeInput(), undefined, { maxRetries: 2, retryDelayMs: 0 });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].agent).toBe("review");
    expect(result.steps[1].status).toBe("failed");
    expect(result.steps[1].error).toBe("Error 3");
  });

  it("marks step as success when retry succeeds", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Transient error"))
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "retry success",
        }),
      );

    const result = await runAgentPipeline(makeInput(), undefined, { maxRetries: 1, retryDelayMs: 0 });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].agent).toBe("review");
    expect(result.steps[1].status).toBe("success");
    expect(result.steps[1].output).not.toBeNull();
  });

  it("calls onStepRetry callback on each retry attempt", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Error 1"))
      .mockRejectedValueOnce(new Error("Error 2"))
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "ok",
        }),
      );

    const onStepRetry = vi.fn();
    await runAgentPipeline(makeInput(), { onStepRetry }, { maxRetries: 2, retryDelayMs: 0 });

    expect(onStepRetry).toHaveBeenCalledTimes(2);
    expect(onStepRetry).toHaveBeenCalledWith("review", 1, 1, 1);
    expect(onStepRetry).toHaveBeenCalledWith("review", 1, 1, 2);
  });

  it("respects retryDelayMs between attempts", async () => {
    vi.useFakeTimers();

    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Error"))
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "ok",
        }),
      );

    const onStepRetry = vi.fn();
    const pipelinePromise = runAgentPipeline(
      makeInput(),
      { onStepRetry },
      { maxRetries: 1, retryDelayMs: 500 },
    );

    await vi.advanceTimersByTimeAsync(500);

    const result = await pipelinePromise;

    expect(result.steps[1].status).toBe("success");
    expect(onStepRetry).toHaveBeenCalledWith("review", 1, 1, 1);

    vi.useRealTimers();
  });

  it("behaves the same as before when retryOptions is not passed", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("Review failed"));

    const result = await runAgentPipeline(makeInput());

    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].status).toBe("failed");
    expect(result.steps[1].error).toBe("Review failed");
  });

  it("does not retry on success", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "ok",
        }),
      );

    const onStepRetry = vi.fn();
    const result = await runAgentPipeline(
      makeInput(),
      { onStepRetry },
      { maxRetries: 3, retryDelayMs: 0 },
    );

    expect(result.steps[1].status).toBe("success");
    expect(onStepRetry).not.toHaveBeenCalled();
  });

  it("calls onStepError only after all retries exhausted", async () => {
    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
        }),
      )
      .mockRejectedValueOnce(new Error("E1"))
      .mockRejectedValueOnce(new Error("E2"));

    const onStepError = vi.fn();
    const onStepRetry = vi.fn();
    await runAgentPipeline(
      makeInput(),
      { onStepError, onStepRetry },
      { maxRetries: 1, retryDelayMs: 0 },
    );

    expect(onStepRetry).toHaveBeenCalledTimes(1);
    expect(onStepRetry).toHaveBeenCalledWith("review", 1, 1, 1);
    expect(onStepError).toHaveBeenCalledTimes(1);
    expect(onStepError).toHaveBeenCalledWith("review", 1, 1, "E2");
  });
});

describe("runAgentPipeline signal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("passes signal to agent execute context", async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    mockCallReviewModel
      .mockResolvedValueOnce(
        JSON.stringify({
          steps: ["review"],
          reasoning: "test",
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

    await runAgentPipeline(makeInput(), undefined, undefined, signal);

    expect(mockCallReviewModel).toHaveBeenCalled();
    expect(mockCallReviewModel.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("aborts pipeline when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const signal = controller.signal;

    mockCallReviewModel.mockRejectedValueOnce(new Error("Request aborted"));

    const result = await runAgentPipeline(makeInput(), undefined, undefined, signal);

    expect(result.steps[0].status).toBe("failed");
  });
});
