import type { AgentDefinition, AgentContext } from "./agent-types";
import { buildPreviousStepsContext, buildPreferenceRulesSection } from "./agent-utils";
import { callReviewModel } from "./llm";

const CURATOR_SYSTEM_PROMPT = `你是一个知识整理智能体（CuratorAgent）。你的职责是根据对话内容给出知识整理和关联建议。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "connections": [
    {
      "source_concept": "源概念",
      "target_concept": "目标概念",
      "connection_type": "关联类型（如：因果、类比、对比、层级、时序等）",
      "reasoning": "关联理由"
    }
  ],
  "organization_tips": ["整理建议1", "整理建议2"],
  "suggested_tags": ["标签1", "标签2"]
}

规则：
- connections 应识别对话中出现的概念之间的深层关联，不要只做表面关键词匹配
- connection_type 应准确反映两个概念之间的关系性质
- organization_tips 应给出可操作的知识整理建议
- suggested_tags 应便于后续检索和分类
- 只输出 JSON，不要输出其他内容`;

export const curatorAgent: AgentDefinition = {
  type: "curator",
  name: "CuratorAgent",
  description: "给出知识整理和关联建议",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const sections = [
      `Background: ${context.input.background}`,
      `Original Goal: ${context.input.originalGoal}`,
      `Conversation (first 2000 chars): ${context.input.conversation.slice(0, 2000)}`,
      `Notes: ${context.input.notes}`,
      `Expected Output: ${context.input.expectedOutput}`,
    ];

    const prevCtx = buildPreviousStepsContext(context.previousSteps, ["review", "depth_evaluation", "asset"]);
    if (prevCtx) {
      sections.push(`\n前序步骤输出：\n${prevCtx}`);
    }

    const rulesSection = buildPreferenceRulesSection(context.input.preferenceRules, "整理建议");
    if (rulesSection) {
      sections.push(rulesSection);
    }

    const userPrompt = sections.join("\n\n");
    const raw = await callReviewModel(CURATOR_SYSTEM_PROMPT, userPrompt);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          connections: [],
          organization_tips: [],
          suggested_tags: [],
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        connections: Array.isArray(parsed.connections)
          ? parsed.connections.map((c: Record<string, unknown>) => ({
              source_concept: typeof c.source_concept === "string" ? c.source_concept : "",
              target_concept: typeof c.target_concept === "string" ? c.target_concept : "",
              connection_type: typeof c.connection_type === "string" ? c.connection_type : "",
              reasoning: typeof c.reasoning === "string" ? c.reasoning : "",
            }))
          : [],
        organization_tips: Array.isArray(parsed.organization_tips)
          ? parsed.organization_tips.filter((t: unknown) => typeof t === "string")
          : [],
        suggested_tags: Array.isArray(parsed.suggested_tags)
          ? parsed.suggested_tags.filter((t: unknown) => typeof t === "string")
          : [],
      };
    } catch {
      return {
        connections: [],
        organization_tips: [],
        suggested_tags: [],
      };
    }
  },
};
