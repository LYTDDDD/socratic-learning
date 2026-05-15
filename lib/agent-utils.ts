import type { AgentStep, AgentType } from "./agent-types";

export function buildPreviousStepsContext(
  previousSteps: AgentStep[],
  agentTypes: AgentType[],
): string {
  const relevant = previousSteps.filter(
    (s) => agentTypes.includes(s.agent) && s.status === "success" && s.output,
  );
  if (relevant.length === 0) return "";
  return relevant
    .map(
      (s) =>
        `[${s.agent} 步骤输出]\n${JSON.stringify(s.output, null, 2)}`,
    )
    .join("\n\n");
}

export function buildPreferenceRulesSection(
  rules: string[],
  contextLabel: string,
): string {
  if (rules.length === 0) return "";
  return [
    "",
    "## 用户偏好规则",
    `以下是用户已确认的偏好规则，请在${contextLabel}时参考：`,
    "",
    ...rules.map((rule, i) => `${i + 1}. ${rule}`),
  ].join("\n");
}
