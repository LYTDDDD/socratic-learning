import { describe, expect, it, vi, beforeEach } from "vitest";
import { supervisorAgent, createStep, completeStep, failStep } from "../lib/supervisor-agent";
import type { AgentContext, AgentStep, AgentDefinition } from "../lib/agent-types";

vi.mock("../lib/llm", () => ({
  callReviewModel: vi.fn(),
}));

import { callReviewModel } from "../lib/llm";

const mockCallReviewModel = vi.mocked(callReviewModel);

function makeContext(overrides?: Partial<AgentContext["input"]>): AgentContext {
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
    previousSteps: [],
  };
}

describe("supervisorAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed steps and reasoning from LLM output", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({
        steps: ["review", "asset"],
        reasoning: "Short conversation, skip depth evaluation",
      }),
    );

    const result = await supervisorAgent.execute(makeContext());

    expect(result.steps).toEqual(["review", "asset"]);
    expect(result.reasoning).toBe("Short conversation, skip depth evaluation");
  });

  it("returns default full pipeline when LLM output has no JSON object", async () => {
    mockCallReviewModel.mockResolvedValueOnce("This is plain text without JSON.");

    const result = await supervisorAgent.execute(makeContext());

    expect(result.steps).toEqual(["review", "depth_evaluation", "asset", "curator", "reflection"]);
    expect(result.reasoning).toContain("无法解析");
  });

  it("returns default full pipeline when JSON parse fails", async () => {
    mockCallReviewModel.mockResolvedValueOnce("{invalid json}");

    const result = await supervisorAgent.execute(makeContext());

    expect(result.steps).toEqual(["review", "depth_evaluation", "asset", "curator", "reflection"]);
    expect(result.reasoning).toContain("解析失败");
  });

  it("returns minimal steps when parsed.steps is not an array", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ steps: "not_an_array", reasoning: "test" }),
    );

    const result = await supervisorAgent.execute(makeContext());

    expect(result.steps).toEqual(["review", "asset"]);
  });

  it("returns empty reasoning when parsed.reasoning is not a string", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ steps: ["review"], reasoning: 123 }),
    );

    const result = await supervisorAgent.execute(makeContext());

    expect(result.reasoning).toBe("");
  });

  it("truncates conversation to 2000 chars in prompt", async () => {
    const longConversation = "a".repeat(5000);
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ steps: ["review"], reasoning: "test" }),
    );

    await supervisorAgent.execute(makeContext({ conversation: longConversation }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("a".repeat(2000));
    expect(userPrompt.length).toBeLessThan(5000);
  });

  it("passes all input fields to LLM", async () => {
    mockCallReviewModel.mockResolvedValueOnce(
      JSON.stringify({ steps: ["review"], reasoning: "test" }),
    );

    await supervisorAgent.execute(makeContext({
      background: "custom bg",
      originalGoal: "custom goal",
      notes: "custom notes",
      expectedOutput: "custom output",
    }));

    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("custom bg");
    expect(userPrompt).toContain("custom goal");
    expect(userPrompt).toContain("custom notes");
    expect(userPrompt).toContain("custom output");
  });

  it("has correct type, name, and description", () => {
    expect(supervisorAgent.type).toBe("supervisor");
    expect(supervisorAgent.name).toBe("SupervisorAgent");
    expect(supervisorAgent.description).toBeTruthy();
  });

  it("propagates LLM call errors", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("API timeout"));

    await expect(supervisorAgent.execute(makeContext())).rejects.toThrow("API timeout");
  });
});

describe("createStep", () => {
  it("creates a running step with correct fields", () => {
    const agent: AgentDefinition = {
      type: "review",
      name: "ReviewAgent",
      description: "test",
      execute: async () => ({}),
    };
    const input = { originalGoal: "test" };

    const step = createStep(agent, input);

    expect(step.agent).toBe("review");
    expect(step.startedAt).toBeTruthy();
    expect(step.finishedAt).toBeNull();
    expect(step.input).toEqual(input);
    expect(step.output).toBeNull();
    expect(step.status).toBe("running");
    expect(step.error).toBeNull();
  });
});

describe("completeStep", () => {
  it("completes a step with output and success status", () => {
    const step: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: null,
      input: {},
      output: null,
      status: "running",
      error: null,
    };
    const output = { summary: "test summary" };

    const completed = completeStep(step, output);

    expect(completed.status).toBe("success");
    expect(completed.finishedAt).toBeTruthy();
    expect(completed.output).toEqual(output);
    expect(completed.error).toBeNull();
    expect(completed.agent).toBe("review");
    expect(completed.startedAt).toBe("2026-01-01T00:00:00Z");
  });
});

describe("failStep", () => {
  it("fails a step with error message", () => {
    const step: AgentStep = {
      agent: "review",
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: null,
      input: {},
      output: null,
      status: "running",
      error: null,
    };

    const failed = failStep(step, "Something went wrong");

    expect(failed.status).toBe("failed");
    expect(failed.finishedAt).toBeTruthy();
    expect(failed.error).toBe("Something went wrong");
    expect(failed.output).toBeNull();
    expect(failed.agent).toBe("review");
  });
});
