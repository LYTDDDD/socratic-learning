export type AgentType =
  | "supervisor"
  | "review"
  | "depth_evaluation"
  | "asset"
  | "curator"
  | "reflection";

export type AgentStep = {
  agent: AgentType;
  startedAt: string;
  finishedAt: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: "running" | "success" | "failed" | "skipped";
  error: string | null;
};

export type AgentPipelineResult = {
  steps: AgentStep[];
  supervisorDecision: string;
};

export type AgentContext = {
  input: {
    background: string;
    originalGoal: string;
    conversation: string;
    notes: string;
    expectedOutput: string;
    preferenceRules: string[];
  };
  previousSteps: AgentStep[];
};

export type AgentDefinition = {
  type: AgentType;
  name: string;
  description: string;
  execute: (context: AgentContext) => Promise<Record<string, unknown>>;
};
