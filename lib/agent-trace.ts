import type { AnalyzeResponse } from "./analyze-types";
import type { AgentStep, AgentType } from "./agent-types";

const VALID_AGENT_TYPES: AgentType[] = ["supervisor", "review", "depth_evaluation", "asset", "curator", "reflection"];
const VALID_STATUSES = ["running", "success", "failed", "skipped"];

function isValidStep(item: unknown): item is AgentStep {
  if (typeof item !== "object" || item === null) return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.agent === "string" &&
    VALID_AGENT_TYPES.includes(s.agent as AgentType) &&
    typeof s.status === "string" &&
    VALID_STATUSES.includes(s.status) &&
    typeof s.startedAt === "string"
  );
}

export function parseAgentSteps(raw: string | null | undefined): AgentStep[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.steps || !Array.isArray(parsed.steps)) return [];
    return parsed.steps.filter(isValidStep);
  } catch {
    return [];
  }
}

export function isMultiAgentResponse(response: Pick<AnalyzeResponse, "raw" | "runLog"> | null): boolean {
  if (!response) return false;
  if (response.runLog?.prompt_version.startsWith("multi-agent:")) return true;
  return parseAgentSteps(response.raw).length > 0;
}
