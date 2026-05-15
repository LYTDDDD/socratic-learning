import { describe, expect, it, vi, beforeEach } from "vitest";
import { reflectionAgent } from "../lib/reflection-agent";
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

describe("reflectionAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed reflection output from LLM", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        reflection_questions: ["你是否考虑过其他架构方案？"],
        action_items: ["下次选型前先列出约束条件"],
        mindset_shifts: ["从追新转向约束匹配"],
      }),
    );

    const result = await reflectionAgent.execute(makeContext());

    expect(result.reflection_questions).toEqual(["你是否考虑过其他架构方案？"]);
    expect(result.action_items).toEqual(["下次选型前先列出约束条件"]);
    expect(result.mindset_shifts).toEqual(["从追新转向约束匹配"]);
  });

  it("filters non-string items from reflection_questions", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        reflection_questions: ["valid q", 42, null, "another q"],
        action_items: [],
        mindset_shifts: [],
      }),
    );

    const result = await reflectionAgent.execute(makeContext());

    expect(result.reflection_questions).toEqual(["valid q", "another q"]);
  });

  it("filters non-string items from action_items", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        reflection_questions: [],
        action_items: ["valid action", true, "another action"],
        mindset_shifts: [],
      }),
    );

    const result = await reflectionAgent.execute(makeContext());

    expect(result.action_items).toEqual(["valid action", "another action"]);
  });

  it("filters non-string items from mindset_shifts", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        reflection_questions: [],
        action_items: [],
        mindset_shifts: ["valid shift", { key: "value" }, "another shift"],
      }),
    );

    const result = await reflectionAgent.execute(makeContext());

    expect(result.mindset_shifts).toEqual(["valid shift", "another shift"]);
  });

  it("returns default empty structure when LLM output has no JSON", async () => {
    mockCallReviewModel.mockResolvedValueOnce("No JSON output");

    const result = await reflectionAgent.execute(makeContext());

    expect(result.reflection_questions).toEqual([]);
    expect(result.action_items).toEqual([]);
    expect(result.mindset_shifts).toEqual([]);
  });

  it("returns default empty structure when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{broken}");

    const result = await reflectionAgent.execute(makeContext());

    expect(result.reflection_questions).toEqual([]);
    expect(result.action_items).toEqual([]);
    expect(result.mindset_shifts).toEqual([]);
  });

  it("handles non-array fields", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        reflection_questions: "not an array",
        action_items: 42,
        mindset_shifts: null,
      }),
    );

    const result = await reflectionAgent.execute(makeContext());

    expect(result.reflection_questions).toEqual([]);
    expect(result.action_items).toEqual([]);
    expect(result.mindset_shifts).toEqual([]);
  });

  it("includes previous steps context from review, depth_evaluation, asset, and curator", async () => {
    const reviewStep: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { summary: "Review" },
      status: "success",
      error: null,
    };
    const curatorStep: AgentStep = {
      agent: "curator",
      startedAt: "2026-01-01T00:00:01Z",
      finishedAt: "2026-01-01T00:00:02Z",
      input: {},
      output: { connections: [] },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ reflection_questions: [], action_items: [], mindset_shifts: [] }),
    );

    await reflectionAgent.execute(makeContext({}, [reviewStep, curatorStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("前序步骤输出");
    expect(userPrompt).toContain("review");
    expect(userPrompt).toContain("curator");
  });

  it("does not include supervisor step in previous steps context", async () => {
    const supervisorStep: AgentStep = {
      agent: "supervisor",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:01Z",
      input: {},
      output: { steps: ["review"], reasoning: "test" },
      status: "success",
      error: null,
    };

    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ reflection_questions: [], action_items: [], mindset_shifts: [] }),
    );

    await reflectionAgent.execute(makeContext({}, [supervisorStep]));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("supervisor 步骤输出");
  });

  it("includes preference rules in prompt", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ reflection_questions: [], action_items: [], mindset_shifts: [] }),
    );

    await reflectionAgent.execute(makeContext({ preferenceRules: ["Focus on actionable items"] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("Focus on actionable items");
    expect(userPrompt).toContain("用户偏好规则");
  });

  it("does not include preference rules section when rules are empty", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ reflection_questions: [], action_items: [], mindset_shifts: [] }),
    );

    await reflectionAgent.execute(makeContext({ preferenceRules: [] }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).not.toContain("用户偏好规则");
  });

  it("truncates conversation to 2000 chars", async () => {
    const longConv = "z".repeat(5000);
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ reflection_questions: [], action_items: [], mindset_shifts: [] }),
    );

    await reflectionAgent.execute(makeContext({ conversation: longConv }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("z".repeat(2000));
  });

  it("has correct type, name, and description", () => {
    expect(reflectionAgent.type).toBe("reflection");
    expect(reflectionAgent.name).toBe("ReflectionAgent");
    expect(reflectionAgent.description).toBeTruthy();
  });

  it("propagates LLM call errors", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(reflectionAgent.execute(makeContext())).rejects.toThrow("Connection refused");
  });
});
