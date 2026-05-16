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

export const AGENT_NAME_MAP: Record<AgentType, string> = {
  supervisor: "编排器",
  review: "复盘",
  depth_evaluation: "深度评估",
  asset: "资产决策",
  curator: "整理建议",
  reflection: "反思建议",
};

export const ASSET_TYPE_MAP: Record<string, string> = {
  principle: "ConceptCard",
  mental_model: "ConceptCard",
  checklist: "MethodCard",
  framework: "MethodCard",
  insight: "ReflectionCard",
  misconception: "MisconceptionCard",
  case: "CaseCard",
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
  signal?: AbortSignal;
};

export type AgentDefinition = {
  type: AgentType;
  name: string;
  description: string;
  execute: (context: AgentContext) => Promise<Record<string, unknown>>;
};

export type SupervisorOutput = {
  steps: string[];
  reasoning: string;
};

export type MisconceptionItem = {
  item: string;
  type: "misconception" | "hidden_assumption" | "exploratory_thinking";
  evidence: string;
  correction: string;
};

export type TurningPoint = {
  turning_point: string;
  evidence: string;
  why_it_matters: string;
};

export type ReviewOutput = {
  summary: string;
  key_decisions: string[];
  turning_points: TurningPoint[];
  key_takeaways: string[];
  misconceptions: MisconceptionItem[];
};

export type DimensionScore = {
  score: number;
  evidence: string;
  uncertainty: "low" | "medium" | "high";
};

export type DepthDimensions = {
  judgment_shift: DimensionScore;
  boundary_clarity: DimensionScore;
  transferability: DimensionScore;
  hidden_assumption: DimensionScore;
  counterexample_awareness: DimensionScore;
  framework_formation: DimensionScore;
  behavior_impact: DimensionScore;
};

export type DepthEvaluationOutput = {
  depth_score: number;
  dimensions: DepthDimensions;
  blind_spots: string[];
  improvement_directions: string[];
  reasoning: string;
};

export type ConceptCardFields = {
  definition: string;
  boundary: string;
  common_confusions: string[];
  examples: string[];
};

export type MisconceptionCardFields = {
  misconception_trigger: string;
  correction_path: string;
  future_warning: string;
  related_correct_concept: string;
};

export type MethodCardFields = {
  when_to_use: string;
  steps: string[];
  pitfalls: string[];
  prerequisites: string[];
};

export type CaseCardFields = {
  background: string;
  decision_point: string;
  outcome: string;
  key_lesson: string;
};

export type ReflectionCardFields = {
  trigger_question: string;
  insight: string;
  mindset_shift: string;
  application_scenario: string;
};

export type CardSpecialFields =
  | { type: "ConceptCard"; fields: ConceptCardFields }
  | { type: "MisconceptionCard"; fields: MisconceptionCardFields }
  | { type: "MethodCard"; fields: MethodCardFields }
  | { type: "CaseCard"; fields: CaseCardFields }
  | { type: "ReflectionCard"; fields: ReflectionCardFields };

export type AssetOutput = {
  has_asset: boolean;
  asset_type: string;
  title: string;
  core_insight: string;
  original_judgment: string;
  revised_judgment: string;
  my_understanding: string;
  transferable_value: string;
  reasoning: string;
  special_fields?: Record<string, unknown>;
};

export type CuratorOutput = {
  connections: Array<{
    source_concept: string;
    target_concept: string;
    connection_type: string;
    reasoning: string;
  }>;
  organization_tips: string[];
  suggested_tags: string[];
};

export type RetryOptions = {
  maxRetries: number;
  retryDelayMs: number;
  retryableErrors?: string[];
};

export type ReflectionOutput = {
  reflection_questions: string[];
  action_items: string[];
  mindset_shifts: string[];
};
