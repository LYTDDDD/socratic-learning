import { describe, expect, it, vi, beforeEach } from "vitest";
import { assetAgent } from "../lib/asset-agent";
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

describe("assetAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed asset output when has_asset is true", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        has_asset: true,
        asset_type: "principle",
        title: "约束驱动选型",
        core_insight: "先看约束再选架构",
        original_judgment: "微服务更现代",
        revised_judgment: "模块化单体更适合",
        my_understanding: "选型不是追新",
        transferable_value: "可迁移到其他决策",
        reasoning: "对话涉及重要认知转变",
      }),
    );

    const result = await assetAgent.execute(makeContext());

    expect(result.has_asset).toBe(true);
    expect(result.asset_type).toBe("principle");
    expect(result.title).toBe("约束驱动选型");
    expect(result.core_insight).toBe("先看约束再选架构");
    expect(result.original_judgment).toBe("微服务更现代");
    expect(result.revised_judgment).toBe("模块化单体更适合");
    expect(result.my_understanding).toBe("选型不是追新");
    expect(result.transferable_value).toBe("可迁移到其他决策");
    expect(result.reasoning).toBe("对话涉及重要认知转变");
  });

  it("returns has_asset false when LLM says no asset", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        has_asset: false,
        asset_type: "",
        title: "",
        core_insight: "",
        original_judgment: "",
        revised_judgment: "",
        my_understanding: "",
        transferable_value: "",
        reasoning: "对话太浅，不值得提取",
      }),
    );

    const result = await assetAgent.execute(makeContext());

    expect(result.has_asset).toBe(false);
    expect(result.reasoning).toBe("对话太浅，不值得提取");
  });

  it("defaults has_asset to false when not boolean", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        has_asset: "yes",
        asset_type: "insight",
        title: "Test",
        core_insight: "insight",
        original_judgment: "",
        revised_judgment: "",
        my_understanding: "",
        transferable_value: "",
        reasoning: "test",
      }),
    );

    const result = await assetAgent.execute(makeContext());
    expect(result.has_asset).toBe(false);
  });

  it("defaults string fields to empty when not strings", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        has_asset: true,
        asset_type: 123,
        title: null,
        core_insight: undefined,
        original_judgment: [],
        revised_judgment: {},
        my_understanding: true,
        transferable_value: false,
        reasoning: 42,
      }),
    );

    const result = await assetAgent.execute(makeContext());

    expect(result.asset_type).toBe("");
    expect(result.title).toBe("");
    expect(result.core_insight).toBe("");
    expect(result.original_judgment).toBe("");
    expect(result.revised_judgment).toBe("");
    expect(result.my_understanding).toBe("");
    expect(result.transferable_value).toBe("");
    expect(result.reasoning).toBe("");
  });

  it("returns default structure when LLM output has no JSON", async () => {
    mockCallReviewModel.mockResolvedValueOnce("No JSON output");

    const result = await assetAgent.execute(makeContext());

    expect(result.has_asset).toBe(false);
    expect(result.reasoning).toContain("无法解析");
  });

  it("returns default structure when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{broken}");

    const result = await assetAgent.execute(makeContext());

    expect(result.has_asset).toBe(false);
    expect(result.reasoning).toContain("解析失败");
  });

  it("includes previous steps context from review and depth_evaluation", async () => {
    const reviewStep: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { summary: "Review done" },
      status: "success",
      error: null,
    };
    const depthStep: AgentStep = {
      agent: "depth_evaluation",
      startedAt: "2026-01-01T00:00:01Z",
      finishedAt: "2026-01-01T00:00:02Z",
      input: {},
      output: { depth_score: 8 },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ has_asset: false, asset_type: "", title: "", core_insight: "", original_judgment: "", revised_judgment: "", my_understanding: "", transferable_value: "", reasoning: "none" }),
    );

    await assetAgent.execute(makeContext({}, [reviewStep, depthStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("前序步骤输出");
    expect(userPrompt).toContain("review");
    expect(userPrompt).toContain("depth_evaluation");
  });

  it("does not include curator step in previous steps context", async () => {
    const curatorStep: AgentStep = {
      agent: "curator",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { connections: [] },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ has_asset: false, asset_type: "", title: "", core_insight: "", original_judgment: "", revised_judgment: "", my_understanding: "", transferable_value: "", reasoning: "none" }),
    );

    await assetAgent.execute(makeContext({}, [curatorStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("curator 步骤输出");
  });

  it("includes preference rules in prompt", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ has_asset: false, asset_type: "", title: "", core_insight: "", original_judgment: "", revised_judgment: "", my_understanding: "", transferable_value: "", reasoning: "none" }),
    );

    await assetAgent.execute(makeContext({ preferenceRules: ["Prefer principle cards"] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("Prefer principle cards");
    expect(userPrompt).toContain("用户偏好规则");
  });

  it("truncates conversation to 2000 chars", async () => {
    const longConv = "y".repeat(5000);
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ has_asset: false, asset_type: "", title: "", core_insight: "", original_judgment: "", revised_judgment: "", my_understanding: "", transferable_value: "", reasoning: "none" }),
    );

    await assetAgent.execute(makeContext({ conversation: longConv }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("y".repeat(2000));
  });

  it("has correct type, name, and description", () => {
    expect(assetAgent.type).toBe("asset");
    expect(assetAgent.name).toBe("AssetAgent");
    expect(assetAgent.description).toBeTruthy();
  });

  it("propagates LLM call errors", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Timeout"));

    await expect(assetAgent.execute(makeContext())).rejects.toThrow("Timeout");
  });
});
