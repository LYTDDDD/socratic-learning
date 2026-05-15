import { describe, expect, it } from "vitest";
import type {
  AgentType,
  AgentStep,
  AgentPipelineResult,
  AgentContext,
  AgentDefinition,
} from "../lib/agent-types";

describe("agent-types", () => {
  describe("AgentType", () => {
    it("accepts all six valid agent type values", () => {
      const types: AgentType[] = [
        "supervisor",
        "review",
        "depth_evaluation",
        "asset",
        "curator",
        "reflection",
      ];
      expect(types).toHaveLength(6);
      expect(types).toContain("supervisor");
      expect(types).toContain("review");
      expect(types).toContain("depth_evaluation");
      expect(types).toContain("asset");
      expect(types).toContain("curator");
      expect(types).toContain("reflection");
    });
  });

  describe("AgentStep", () => {
    it("constructs a valid running step", () => {
      const step: AgentStep = {
        agent: "review",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        input: { originalGoal: "test" },
        output: null,
        status: "running",
        error: null,
      };
      expect(step.status).toBe("running");
      expect(step.finishedAt).toBeNull();
      expect(step.output).toBeNull();
      expect(step.error).toBeNull();
    });

    it("constructs a valid success step", () => {
      const step: AgentStep = {
        agent: "depth_evaluation",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        input: {},
        output: { depth_score: 7 },
        status: "success",
        error: null,
      };
      expect(step.status).toBe("success");
      expect(step.finishedAt).not.toBeNull();
      expect(step.output).toBeDefined();
    });

    it("constructs a valid failed step", () => {
      const step: AgentStep = {
        agent: "asset",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        input: {},
        output: null,
        status: "failed",
        error: "API error",
      };
      expect(step.status).toBe("failed");
      expect(step.error).toBe("API error");
    });

    it("constructs a valid skipped step", () => {
      const step: AgentStep = {
        agent: "curator",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        input: {},
        output: null,
        status: "skipped",
        error: null,
      };
      expect(step.status).toBe("skipped");
    });
  });

  describe("AgentPipelineResult", () => {
    it("constructs a valid pipeline result", () => {
      const result: AgentPipelineResult = {
        steps: [],
        supervisorDecision: "test reasoning",
      };
      expect(result.steps).toEqual([]);
      expect(result.supervisorDecision).toBe("test reasoning");
    });
  });

  describe("AgentContext", () => {
    it("constructs a valid context with all input fields", () => {
      const context: AgentContext = {
        input: {
          background: "bg",
          originalGoal: "goal",
          conversation: "conv",
          notes: "notes",
          expectedOutput: "expected",
          preferenceRules: ["rule1"],
        },
        previousSteps: [],
      };
      expect(context.input.background).toBe("bg");
      expect(context.input.originalGoal).toBe("goal");
      expect(context.input.conversation).toBe("conv");
      expect(context.input.preferenceRules).toEqual(["rule1"]);
      expect(context.previousSteps).toEqual([]);
    });

    it("allows empty preferenceRules", () => {
      const context: AgentContext = {
        input: {
          background: "",
          originalGoal: "",
          conversation: "",
          notes: "",
          expectedOutput: "",
          preferenceRules: [],
        },
        previousSteps: [],
      };
      expect(context.input.preferenceRules).toEqual([]);
    });
  });

  describe("AgentDefinition", () => {
    it("defines a valid agent with all required fields", () => {
      const agent: AgentDefinition = {
        type: "review",
        name: "ReviewAgent",
        description: "Reviews conversations",
        execute: async () => ({ summary: "test" }),
      };
      expect(agent.type).toBe("review");
      expect(agent.name).toBe("ReviewAgent");
      expect(typeof agent.execute).toBe("function");
    });

    it("execute returns a promise of Record<string, unknown>", async () => {
      const agent: AgentDefinition = {
        type: "reflection",
        name: "ReflectionAgent",
        description: "Reflects",
        execute: async () => ({ reflection_questions: ["q1"] }),
      };
      const result = await agent.execute({
        input: {
          background: "",
          originalGoal: "",
          conversation: "",
          notes: "",
          expectedOutput: "",
          preferenceRules: [],
        },
        previousSteps: [],
      });
      expect(result).toEqual({ reflection_questions: ["q1"] });
    });
  });
});
