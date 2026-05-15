import type { AgentDefinition, AgentContext, AgentStep } from "./agent-types";
import { callReviewModel } from "./llm";

const REFLECTION_SYSTEM_PROMPT = `你是一个反思智能体（ReflectionAgent）。你的职责是根据对话内容给出个人反思和行动建议。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "reflection_questions": ["反思问题1", "反思问题2"],
  "action_items": ["行动建议1", "行动建议2"],
  "mindset_shifts": ["思维转变建议1", "思维转变建议2"]
}

规则：
- reflection_questions 应引导深入思考，而非简单的是非问题
- action_items 应具体可执行，避免过于笼统
- mindset_shifts 应指出潜在的思维盲点或可改进的思维模式
- 只输出 JSON，不要输出其他内容`;

function buildPreviousStepsContext(previousSteps: AgentStep[]): string {
  const relevant = previousSteps.filter(
    (s) =>
      s.agent === "review" ||
      s.agent === "depth_evaluation" ||
      s.agent === "asset" ||
      s.agent === "curator",
  );
  if (relevant.length === 0) return "";
  return relevant
    .map(
      (s) =>
        `[${s.agent} 步骤输出]\n${s.output ? JSON.stringify(s.output, null, 2) : "无输出"}`,
    )
    .join("\n\n");
}

function buildPreferenceRulesSection(rules: string[]): string {
  if (rules.length === 0) return "";
  return [
    "",
    "## 用户偏好规则",
    "以下是用户已确认的偏好规则，请在反思建议时参考：",
    "",
    ...rules.map((rule, i) => `${i + 1}. ${rule}`),
  ].join("\n");
}

export const reflectionAgent: AgentDefinition = {
  type: "reflection",
  name: "ReflectionAgent",
  description: "给出个人反思和行动建议",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const sections = [
      `Background: ${context.input.background}`,
      `Original Goal: ${context.input.originalGoal}`,
      `Conversation (first 2000 chars): ${context.input.conversation.slice(0, 2000)}`,
      `Notes: ${context.input.notes}`,
      `Expected Output: ${context.input.expectedOutput}`,
    ];

    const prevCtx = buildPreviousStepsContext(context.previousSteps);
    if (prevCtx) {
      sections.push(`\n前序步骤输出：\n${prevCtx}`);
    }

    const rulesSection = buildPreferenceRulesSection(context.input.preferenceRules);
    if (rulesSection) {
      sections.push(rulesSection);
    }

    const userPrompt = sections.join("\n\n");
    const raw = await callReviewModel(REFLECTION_SYSTEM_PROMPT, userPrompt);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          reflection_questions: [],
          action_items: [],
          mindset_shifts: [],
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reflection_questions: Array.isArray(parsed.reflection_questions)
          ? parsed.reflection_questions.filter((q: unknown) => typeof q === "string")
          : [],
        action_items: Array.isArray(parsed.action_items)
          ? parsed.action_items.filter((a: unknown) => typeof a === "string")
          : [],
        mindset_shifts: Array.isArray(parsed.mindset_shifts)
          ? parsed.mindset_shifts.filter((m: unknown) => typeof m === "string")
          : [],
      };
    } catch {
      return {
        reflection_questions: [],
        action_items: [],
        mindset_shifts: [],
      };
    }
  },
};
