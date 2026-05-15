import { describe, expect, it, vi, beforeEach } from "vitest";
import { reviewAgent } from "../lib/review-agent";
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

describe("reviewAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed review output from LLM", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        key_decisions: ["选择了微服务架构"],
        turning_points: ["从单体转向微服务"],
        key_takeaways: ["团队规模决定架构选择"],
        summary: "对话复盘总结",
      }),
    );

    const result = await reviewAgent.execute(makeContext());

    expect(result.key_decisions).toEqual(["选择了微服务架构"]);
    expect(result.turning_points).toEqual(["从单体转向微服务"]);
    expect(result.key_takeaways).toEqual(["团队规模决定架构选择"]);
    expect(result.summary).toBe("对话复盘总结");
  });

  it("returns default structure when LLM output has no JSON", async () => {
    mockCallReviewModel.mockResolvedValueOnce("Plain text without JSON");

    const result = await reviewAgent.execute(makeContext());

    expect(result.key_decisions).toEqual([]);
    expect(result.turning_points).toEqual([]);
    expect(result.key_takeaways).toEqual([]);
    expect(result.summary).toContain("无法解析");
  });

  it("returns default structure when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{broken json}");

    const result = await reviewAgent.execute(makeContext());

    expect(result.key_decisions).toEqual([]);
    expect(result.summary).toContain("解析失败");
  });

  it("handles missing array fields gracefully", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ summary: "Only summary" }),
    );

    const result = await reviewAgent.execute(makeContext());

    expect(result.key_decisions).toEqual([]);
    expect(result.turning_points).toEqual([]);
    expect(result.key_takeaways).toEqual([]);
    expect(result.summary).toBe("Only summary");
  });

  it("handles missing summary field", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ key_decisions: ["d1"] }),
    );

    const result = await reviewAgent.execute(makeContext());

    expect(result.summary).toContain("缺少总结");
  });

  it("includes supervisor reasoning in prompt when available", async () => {
    const supervisorStep: AgentStep = {
      agent: "supervisor",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { steps: ["review"], reasoning: "Need deep review" },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ key_decisions: [], turning_points: [], key_takeaways: [], summary: "test" }),
    );

    await reviewAgent.execute(makeContext({}, [supervisorStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("Need deep review");
  });

  it("includes preference rules in prompt when available", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ key_decisions: [], turning_points: [], key_takeaways: [], summary: "test" }),
    );

    await reviewAgent.execute(makeContext({ preferenceRules: ["Always question assumptions"] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("Always question assumptions");
  });

  it("does not include preference rules section when rules are empty", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ key_decisions: [], turning_points: [], key_takeaways: [], summary: "test" }),
    );

    await reviewAgent.execute(makeContext({ preferenceRules: [] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("Preference Rules");
  });

  it("truncates conversation to 4000 chars", async () => {
    const longConv = "x".repeat(8000);
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ key_decisions: [], turning_points: [], key_takeaways: [], summary: "test" }),
    );

    await reviewAgent.execute(makeContext({ conversation: longConv }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("x".repeat(4000));
  });

  it("has correct type, name, and description", () => {
    expect(reviewAgent.type).toBe("review");
    expect(reviewAgent.name).toBe("ReviewAgent");
    expect(reviewAgent.description).toBeTruthy();
  });

  it("propagates LLM call errors", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Network error"));

    await expect(reviewAgent.execute(makeContext())).rejects.toThrow("Network error");
  });
});
