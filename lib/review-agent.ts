import type { AgentDefinition, AgentContext } from "./agent-types";
import { callReviewModel } from "./llm";

const REVIEW_SYSTEM_PROMPT = `你是一个对话复盘分析器（ReviewAgent）。你的职责是分析对话内容，总结关键决策、转折点和收获。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "key_decisions": ["决策1", "决策2"],
  "turning_points": ["转折点1", "转折点2"],
  "key_takeaways": ["收获1", "收获2"],
  "summary": "整体复盘总结"
}

规则：
- key_decisions：列出对话中做出的关键决策或选择
- turning_points：列出对话中思路或方向发生转变的关键时刻
- key_takeaways：列出从对话中获得的核心收获或洞察
- summary：用一段话概括整个对话的复盘结论
- 每个列表至少包含一项，最多五项
- 只输出 JSON，不要输出其他内容`;

export const reviewAgent: AgentDefinition = {
  type: "review",
  name: "ReviewAgent",
  description: "对话复盘，总结关键决策、转折点和收获",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const supervisorStep = context.previousSteps.find(
      (s) => s.agent === "supervisor" && s.status === "success" && s.output,
    );
    const supervisorContext = supervisorStep?.output?.reasoning
      ? `\n\nSupervisor 编排理由：${supervisorStep.output.reasoning as string}`
      : "";

    const userPrompt = [
      `Background: ${context.input.background}`,
      `Original Goal: ${context.input.originalGoal}`,
      `Conversation: ${context.input.conversation.slice(0, 4000)}`,
      `Notes: ${context.input.notes}`,
      `Expected Output: ${context.input.expectedOutput}`,
      context.input.preferenceRules.length > 0
        ? `Preference Rules: ${context.input.preferenceRules.join("; ")}`
        : "",
      supervisorContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await callReviewModel(REVIEW_SYSTEM_PROMPT, userPrompt);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          key_decisions: [],
          turning_points: [],
          key_takeaways: [],
          summary: "无法解析复盘输出，返回默认结构",
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        key_decisions: Array.isArray(parsed.key_decisions)
          ? parsed.key_decisions
          : [],
        turning_points: Array.isArray(parsed.turning_points)
          ? parsed.turning_points
          : [],
        key_takeaways: Array.isArray(parsed.key_takeaways)
          ? parsed.key_takeaways
          : [],
        summary:
          typeof parsed.summary === "string"
            ? parsed.summary
            : "复盘输出缺少总结字段",
      };
    } catch {
      return {
        key_decisions: [],
        turning_points: [],
        key_takeaways: [],
        summary: "复盘输出解析失败，返回默认结构",
      };
    }
  },
};
