import { describe, expect, it } from "vitest";
import { parseAgentSteps } from "../components/AgentStepProgress";

describe("parseAgentSteps", () => {
  it("parses valid { steps, supervisorDecision } JSON", () => {
    const raw = JSON.stringify({
      steps: [
        {
          agent: "supervisor",
          startedAt: "2025-01-01T00:00:00Z",
          finishedAt: "2025-01-01T00:00:01Z",
          input: {},
          output: { reasoning: "test" },
          status: "success",
          error: null,
        },
        {
          agent: "review",
          startedAt: "2025-01-01T00:00:01Z",
          finishedAt: "2025-01-01T00:00:03Z",
          input: {},
          output: { summary: "reviewed" },
          status: "success",
          error: null,
        },
      ],
      supervisorDecision: "proceed",
    });

    const result = parseAgentSteps(raw);
    expect(result).toHaveLength(2);
    expect(result[0].agent).toBe("supervisor");
    expect(result[0].status).toBe("success");
    expect(result[1].agent).toBe("review");
    expect(result[1].output).toEqual({ summary: "reviewed" });
  });

  it("returns empty array for null input", () => {
    expect(parseAgentSteps(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(parseAgentSteps(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAgentSteps("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseAgentSteps("not json at all")).toEqual([]);
  });

  it("returns empty array for JSON without steps field", () => {
    const raw = JSON.stringify({ supervisorDecision: "proceed" });
    expect(parseAgentSteps(raw)).toEqual([]);
  });

  it("returns empty array when steps is not an array", () => {
    const raw = JSON.stringify({ steps: "not an array", supervisorDecision: "x" });
    expect(parseAgentSteps(raw)).toEqual([]);
  });

  it("returns empty array when steps is a number", () => {
    const raw = JSON.stringify({ steps: 42 });
    expect(parseAgentSteps(raw)).toEqual([]);
  });

  it("returns empty array when steps is an object instead of array", () => {
    const raw = JSON.stringify({ steps: { a: 1 } });
    expect(parseAgentSteps(raw)).toEqual([]);
  });

  it("returns steps array when parsed.steps is a valid array", () => {
    const raw = JSON.stringify({
      steps: [
        {
          agent: "depth_evaluation",
          startedAt: "2025-01-01T00:00:00Z",
          finishedAt: null,
          input: {},
          output: null,
          status: "running",
          error: null,
        },
      ],
    });

    const result = parseAgentSteps(raw);
    expect(result).toHaveLength(1);
    expect(result[0].agent).toBe("depth_evaluation");
    expect(result[0].status).toBe("running");
  });

  it("returns empty steps array as-is", () => {
    const raw = JSON.stringify({ steps: [], supervisorDecision: "" });
    const result = parseAgentSteps(raw);
    expect(result).toEqual([]);
  });
});
