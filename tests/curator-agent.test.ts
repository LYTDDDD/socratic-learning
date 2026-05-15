import { describe, expect, it, vi, beforeEach } from "vitest";
import { curatorAgent } from "../lib/curator-agent";
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

describe("curatorAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed curator output from LLM", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        connections: [
          { source_concept: "微服务", target_concept: "单体", connection_type: "对比", reasoning: "架构选型对比" },
        ],
        organization_tips: ["建立架构决策记录"],
        suggested_tags: ["架构", "选型"],
      }),
    );

    const result = await curatorAgent.execute(makeContext());
    const connections = result.connections as Array<Record<string, string>>;

    expect(connections).toHaveLength(1);
    expect(connections[0]).toEqual({
      source_concept: "微服务",
      target_concept: "单体",
      connection_type: "对比",
      reasoning: "架构选型对比",
    });
    expect(result.organization_tips).toEqual(["建立架构决策记录"]);
    expect(result.suggested_tags).toEqual(["架构", "选型"]);
  });

  it("handles connections with missing string fields", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        connections: [
          { source_concept: 123, target_concept: null, connection_type: true, reasoning: undefined },
        ],
        organization_tips: [],
        suggested_tags: [],
      }),
    );

    const result = await curatorAgent.execute(makeContext());
    const connections = result.connections as Array<Record<string, string>>;

    expect(connections).toHaveLength(1);
    expect(connections[0].source_concept).toBe("");
    expect(connections[0].target_concept).toBe("");
    expect(connections[0].connection_type).toBe("");
    expect(connections[0].reasoning).toBe("");
  });

  it("filters non-string items from organization_tips", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        connections: [],
        organization_tips: ["valid tip", 42, null, "another tip"],
        suggested_tags: [],
      }),
    );

    const result = await curatorAgent.execute(makeContext());

    expect(result.organization_tips).toEqual(["valid tip", "another tip"]);
  });

  it("filters non-string items from suggested_tags", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        connections: [],
        organization_tips: [],
        suggested_tags: ["tag1", 99, "tag2"],
      }),
    );

    const result = await curatorAgent.execute(makeContext());

    expect(result.suggested_tags).toEqual(["tag1", "tag2"]);
  });

  it("returns default empty structure when LLM output has no JSON", async () => {
    mockCallReviewModel.mockResolvedValueOnce("No JSON");

    const result = await curatorAgent.execute(makeContext());

    expect(result.connections).toEqual([]);
    expect(result.organization_tips).toEqual([]);
    expect(result.suggested_tags).toEqual([]);
  });

  it("returns default empty structure when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{invalid}");

    const result = await curatorAgent.execute(makeContext());

    expect(result.connections).toEqual([]);
    expect(result.organization_tips).toEqual([]);
    expect(result.suggested_tags).toEqual([]);
  });

  it("handles non-array connections field", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        connections: "not an array",
        organization_tips: [],
        suggested_tags: [],
      }),
    );

    const result = await curatorAgent.execute(makeContext());

    expect(result.connections).toEqual([]);
  });

  it("includes previous steps context from review, depth_evaluation, and asset", async () => {
    const reviewStep: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { summary: "Review" },
      status: "success",
      error: null,
    };
    const assetStep: AgentStep = {
      agent: "asset",
      startedAt: "2026-01-01T00:00:01Z",
      finishedAt: "2026-01-01T00:00:02Z",
      input: {},
      output: { has_asset: true, title: "Asset" },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ connections: [], organization_tips: [], suggested_tags: [] }),
    );

    await curatorAgent.execute(makeContext({}, [reviewStep, assetStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("前序步骤输出");
    expect(userPrompt).toContain("review");
    expect(userPrompt).toContain("asset");
  });

  it("does not include reflection step in previous steps context", async () => {
    const reflectionStep: AgentStep = {
      agent: "reflection",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { reflection_questions: [] },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ connections: [], organization_tips: [], suggested_tags: [] }),
    );

    await curatorAgent.execute(makeContext({}, [reflectionStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("reflection 步骤输出");
  });

  it("includes preference rules in prompt", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ connections: [], organization_tips: [], suggested_tags: [] }),
    );

    await curatorAgent.execute(makeContext({ preferenceRules: ["Organize by topic"] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("Organize by topic");
    expect(userPrompt).toContain("用户偏好规则");
  });

  it("has correct type, name, and description", () => {
    expect(curatorAgent.type).toBe("curator");
    expect(curatorAgent.name).toBe("CuratorAgent");
    expect(curatorAgent.description).toBeTruthy();
  });

  it("propagates LLM call errors", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Service unavailable"));

    await expect(curatorAgent.execute(makeContext())).rejects.toThrow("Service unavailable");
  });
});
