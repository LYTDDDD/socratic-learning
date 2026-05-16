import { describe, expect, it, vi, beforeEach } from "vitest";
import { depthEvaluationAgent } from "../lib/depth-evaluation-agent";
import type { AgentContext, AgentStep, DepthDimensions } from "../lib/agent-types";

vi.mock("../lib/llm", () => ({
  callReviewModel: vi.fn(),
}));

import { callReviewModel } from "../lib/llm";

const mockCallReviewModel = vi.mocked(callReviewModel);

function makeContext(overrides?: Partial<AgentContext["input"]>, previousSteps?: AgentStep[]): AgentContext {
  return {
    input: {
      background: "test bg",
      originalGoal: "test goal",
      conversation: "test conversation",
      notes: "test notes",
      expectedOutput: "test output",
      preferenceRules: [],
      ...overrides,
    },
    previousSteps: previousSteps ?? [],
  };
}

function makeDimensions(overrides?: Record<string, { score: number; evidence: string; uncertainty: string }>): Record<string, { score: number; evidence: string; uncertainty: string }> {
  const defaults: Record<string, { score: number; evidence: string; uncertainty: string }> = {
    judgment_shift: { score: 5, evidence: "test", uncertainty: "medium" },
    boundary_clarity: { score: 5, evidence: "test", uncertainty: "medium" },
    transferability: { score: 5, evidence: "test", uncertainty: "medium" },
    hidden_assumption: { score: 5, evidence: "test", uncertainty: "medium" },
    counterexample_awareness: { score: 5, evidence: "test", uncertainty: "medium" },
    framework_formation: { score: 5, evidence: "test", uncertainty: "medium" },
    behavior_impact: { score: 5, evidence: "test", uncertainty: "medium" },
  };
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}

describe("depthEvaluationAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed depth evaluation with dimensions from LLM", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions({
          judgment_shift: { score: 8, evidence: "修正了判断", uncertainty: "low" },
          transferability: { score: 7, evidence: "可迁移到其他场景", uncertainty: "medium" },
        }),
        blind_spots: ["未考虑性能影响"],
        improvement_directions: ["深入分析性能指标"],
        reasoning: "对话触及了核心问题但缺少量化分析",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;

    expect(result.blind_spots).toEqual(["未考虑性能影响"]);
    expect(result.improvement_directions).toEqual(["深入分析性能指标"]);
    expect(result.reasoning).toContain("核心问题");
    expect(result.dimensions).toBeDefined();
    const dims = result.dimensions as DepthDimensions;
    expect(dims.judgment_shift.score).toBe(8);
    expect(dims.judgment_shift.evidence).toBe("修正了判断");
    expect(dims.judgment_shift.uncertainty).toBe("low");
    expect(dims.transferability.score).toBe(7);
  });

  it("computes depth_score as weighted average of dimensions", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions({
          judgment_shift: { score: 10, evidence: "test", uncertainty: "low" },
          boundary_clarity: { score: 4, evidence: "test", uncertainty: "medium" },
          transferability: { score: 10, evidence: "test", uncertainty: "low" },
          hidden_assumption: { score: 4, evidence: "test", uncertainty: "medium" },
          counterexample_awareness: { score: 4, evidence: "test", uncertainty: "medium" },
          framework_formation: { score: 4, evidence: "test", uncertainty: "medium" },
          behavior_impact: { score: 4, evidence: "test", uncertainty: "medium" },
        }),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;

    const weightedSum = 10 * 1.5 + 4 * 1.0 + 10 * 1.5 + 4 * 1.0 + 4 * 1.0 + 4 * 1.0 + 4 * 1.0;
    const totalWeight = 1.5 + 1.0 + 1.5 + 1.0 + 1.0 + 1.0 + 1.0;
    const expected = Math.round(weightedSum / totalWeight);
    expect(result.depth_score).toBe(expected);
  });

  it("parses dimensions correctly from LLM output", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions({
          judgment_shift: { score: 9, evidence: "明确修正", uncertainty: "low" },
          boundary_clarity: { score: 3, evidence: "边界模糊", uncertainty: "high" },
        }),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;
    const dims = result.dimensions as DepthDimensions;

    expect(dims.judgment_shift.score).toBe(9);
    expect(dims.judgment_shift.evidence).toBe("明确修正");
    expect(dims.judgment_shift.uncertainty).toBe("low");
    expect(dims.boundary_clarity.score).toBe(3);
    expect(dims.boundary_clarity.evidence).toBe("边界模糊");
    expect(dims.boundary_clarity.uncertainty).toBe("high");
  });

  it("defaults dimensions when missing from LLM output", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;
    const dims = result.dimensions as DepthDimensions;

    expect(dims).toBeDefined();
    const keys = ["judgment_shift", "boundary_clarity", "transferability", "hidden_assumption", "counterexample_awareness", "framework_formation", "behavior_impact"] as const;
    for (const key of keys) {
      expect(dims[key].score).toBe(5);
      expect(dims[key].evidence).toBe("");
      expect(dims[key].uncertainty).toBe("medium");
    }
  });

  it("clamps individual dimension score to 1-10 range", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions({
          judgment_shift: { score: 15, evidence: "test", uncertainty: "low" },
          boundary_clarity: { score: -3, evidence: "test", uncertainty: "medium" },
        }),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;
    const dims = result.dimensions as DepthDimensions;

    expect(dims.judgment_shift.score).toBe(10);
    expect(dims.boundary_clarity.score).toBe(1);
  });

  it("defaults uncertainty to medium for invalid values", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions({
          judgment_shift: { score: 5, evidence: "test", uncertainty: "invalid" },
        }),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;
    const dims = result.dimensions as DepthDimensions;

    expect(dims.judgment_shift.uncertainty).toBe("medium");
  });

  it("defaults dimension to score 5 when dimension value is not an object", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: {
          judgment_shift: null,
          boundary_clarity: "invalid",
          transferability: 42,
          hidden_assumption: { score: 7, evidence: "valid", uncertainty: "low" },
          counterexample_awareness: undefined,
          framework_formation: {},
          behavior_impact: { score: "bad" },
        },
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;
    const dims = result.dimensions as DepthDimensions;

    expect(dims.judgment_shift.score).toBe(5);
    expect(dims.judgment_shift.uncertainty).toBe("medium");
    expect(dims.boundary_clarity.score).toBe(5);
    expect(dims.transferability.score).toBe(5);
    expect(dims.hidden_assumption.score).toBe(7);
    expect(dims.hidden_assumption.evidence).toBe("valid");
    expect(dims.hidden_assumption.uncertainty).toBe("low");
    expect(dims.counterexample_awareness.score).toBe(5);
    expect(dims.framework_formation.score).toBe(5);
    expect(dims.framework_formation.evidence).toBe("");
    expect(dims.behavior_impact.score).toBe(5);
  });

  it("returns default structure with dimensions when LLM output has no JSON", async () => {
    mockCallReviewModel.mockResolvedValueOnce("No JSON here");

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;

    expect(result.depth_score).toBe(1);
    expect(result.blind_spots).toEqual([]);
    expect(result.improvement_directions).toEqual([]);
    expect(result.reasoning).toContain("无法解析");
    expect(result.dimensions).toBeDefined();
    const dims = result.dimensions as DepthDimensions;
    expect(dims.judgment_shift.score).toBe(5);
  });

  it("returns default structure with dimensions when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{bad json}");

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;

    expect(result.reasoning).toContain("解析失败");
    expect(result.dimensions).toBeDefined();
    const dims = result.dimensions as DepthDimensions;
    expect(dims.judgment_shift.score).toBe(5);
  });

  it("handles missing array fields", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions(),
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;

    expect(result.blind_spots).toEqual([]);
    expect(result.improvement_directions).toEqual([]);
  });

  it("handles missing reasoning field", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions(),
        blind_spots: [],
        improvement_directions: [],
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext()) as Record<string, unknown>;

    expect(result.reasoning).toContain("缺少理由");
  });

  it("includes review step context when available", async () => {
    const reviewStep: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { summary: "Review summary", key_decisions: ["d1"] },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions(),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    await depthEvaluationAgent.execute(makeContext({}, [reviewStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("复盘结果上下文");
    expect(userPrompt).toContain("Review summary");
  });

  it("does not include review context when review step failed", async () => {
    const failedReviewStep: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: null,
      status: "failed",
      error: "error",
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions(),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    await depthEvaluationAgent.execute(makeContext({}, [failedReviewStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("复盘结果上下文");
  });

  it("includes preference rules in prompt", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        dimensions: makeDimensions(),
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    await depthEvaluationAgent.execute(makeContext({ preferenceRules: ["Focus on depth"] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("Focus on depth");
  });

  it("has correct type, name, and description", () => {
    expect(depthEvaluationAgent.type).toBe("depth_evaluation");
    expect(depthEvaluationAgent.name).toBe("DepthEvaluationAgent");
    expect(depthEvaluationAgent.description).toBeTruthy();
  });

  it("propagates LLM call errors", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Rate limited"));

    await expect(depthEvaluationAgent.execute(makeContext())).rejects.toThrow("Rate limited");
  });
});
