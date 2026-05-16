import type { AgentDefinition, AgentContext } from "./agent-types";
import { buildPreviousStepsContext, buildPreferenceRulesSection } from "./agent-utils";
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
- action_items 中的每项必须满足 SMART 原则：
  - 具体的（Specific）：明确做什么，不是"继续学习"
  - 可衡量的（Measurable）：有完成标准
  - 可达成的（Achievable）：基于当前状态可实现
  - 相关的（Relevant）：与分析发现直接相关
  - 有时限的（Time-bound）：建议完成时间

示例：
❌ "继续学习这个话题"
✅ "本周内用 [具体方法] 重新审视 [具体场景] 中的 [具体判断]"
- mindset_shifts 应指出潜在的思维盲点或可改进的思维模式
- 只输出 JSON，不要输出其他内容

输出前自检：
1. reflection_questions 是否具体可回答（不能是"你学到了什么"这类泛泛的问题）
2. action_items 是否具体可执行（不能是"继续学习"这类模糊建议）
3. action_items 是否满足 SMART 原则（每项必须具体、可衡量、有时限）
4. mindset_shifts 是否有对话中的证据支撑`;

export const reflectionAgent: AgentDefinition = {
  type: "reflection",
  name: "ReflectionAgent",
  description: "给出个人反思和行动建议",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const sections = [
      `Background: ${context.input.background}`,
      `Original Goal: ${context.input.originalGoal}`,
      `Conversation (first 4000 chars): ${context.input.conversation.slice(0, 4000)}`,
      `Notes: ${context.input.notes}`,
      `Expected Output: ${context.input.expectedOutput}`,
    ];

    const prevCtx = buildPreviousStepsContext(context.previousSteps, ["review", "depth_evaluation", "asset", "curator"]);
    if (prevCtx) {
      sections.push(`\n前序步骤输出：\n${prevCtx}`);
    }

    const rulesSection = buildPreferenceRulesSection(context.input.preferenceRules, "反思建议");
    if (rulesSection) {
      sections.push(rulesSection);
    }

    const userPrompt = sections.join("\n\n");
    const raw = await callReviewModel(REFLECTION_SYSTEM_PROMPT, userPrompt, context.signal);

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
