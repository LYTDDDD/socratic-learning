import { describe, expect, it, vi, beforeEach } from "vitest";
import { depthEvaluationAgent } from "../lib/depth-evaluation-agent";
import type { AgentContext, AgentStep } from "../lib/agent-types";

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

describe("depthEvaluationAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed depth evaluation from LLM", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        depth_score: 7,
        blind_spots: ["未考虑性能影响"],
        improvement_directions: ["深入分析性能指标"],
        reasoning: "对话触及了核心问题但缺少量化分析",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());

    expect(result.depth_score).toBe(7);
    expect(result.blind_spots).toEqual(["未考虑性能影响"]);
    expect(result.improvement_directions).toEqual(["深入分析性能指标"]);
    expect(result.reasoning).toContain("核心问题");
  });

  it("clamps depth_score to 1-10 range", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        depth_score: 15,
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());
    expect(result.depth_score).toBe(10);
  });

  it("clamps depth_score to minimum 1", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        depth_score: -3,
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());
    expect(result.depth_score).toBe(1);
  });

  it("rounds depth_score to integer", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        depth_score: 6.7,
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());
    expect(result.depth_score).toBe(7);
  });

  it("defaults depth_score to 1 when not a number", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        depth_score: "high",
        blind_spots: [],
        improvement_directions: [],
        reasoning: "test",
      }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());
    expect(result.depth_score).toBe(1);
  });

  it("returns default structure when LLM output has no JSON", async () => {
    mockCallReviewModel.mockResolvedValueOnce("No JSON here");

    const result = await depthEvaluationAgent.execute(makeContext());

    expect(result.depth_score).toBe(1);
    expect(result.blind_spots).toEqual([]);
    expect(result.improvement_directions).toEqual([]);
    expect(result.reasoning).toContain("无法解析");
  });

  it("returns default structure when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{bad json}");

    const result = await depthEvaluationAgent.execute(makeContext());

    expect(result.reasoning).toContain("解析失败");
  });

  it("handles missing array fields", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ depth_score: 5, reasoning: "test" }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());

    expect(result.blind_spots).toEqual([]);
    expect(result.improvement_directions).toEqual([]);
  });

  it("handles missing reasoning field", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ depth_score: 5, blind_spots: [], improvement_directions: [] }),
    );

    const result = await depthEvaluationAgent.execute(makeContext());

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
      JSON.stringify({ depth_score: 5, blind_spots: [], improvement_directions: [], reasoning: "test" }),
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
      JSON.stringify({ depth_score: 5, blind_spots: [], improvement_directions: [], reasoning: "test" }),
    );

    await depthEvaluationAgent.execute(makeContext({}, [failedReviewStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("复盘结果上下文");
  });

  it("includes preference rules in prompt", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ depth_score: 5, blind_spots: [], improvement_directions: [], reasoning: "test" }),
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
