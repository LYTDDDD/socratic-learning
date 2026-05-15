import type { AgentDefinition, AgentContext } from "./agent-types";
import { callReviewModel } from "./llm";

const REVIEW_SYSTEM_PROMPT = `你是一个对话复盘分析器（ReviewAgent）。你的职责是分析对话内容，总结关键决策、转折点和收获，并识别误区和隐藏假设。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "key_decisions": ["决策1", "决策2"],
  "turning_points": ["转折点1", "转折点2"],
  "key_takeaways": ["收获1", "收获2"],
  "summary": "整体复盘总结",
  "misconceptions": [
    {
      "item": "识别到的误区或隐藏假设",
      "type": "misconception | hidden_assumption | exploratory_thinking",
      "evidence": "来自对话的证据",
      "correction": "纠正建议"
    }
  ]
}

规则：
- key_decisions：列出对话中做出的关键决策或选择
- turning_points：列出对话中思路或方向发生转变的关键时刻
- key_takeaways：列出从对话中获得的核心收获或洞察
- summary：用一段话概括整个对话的复盘结论
- misconceptions：识别对话中的误区、隐藏假设或值得探索的思考
  - misconception：明确的认知误区或错误理解
  - hidden_assumption：未明说但影响推理的假设
  - exploratory_thinking：值得进一步探索的思路
- 每个列表至少包含一项，最多五项
- misconceptions 中每项必须有 evidence 支持
- 只输出 JSON，不要输出其他内容

输出前自检：
1. key_takeaways 是否只是对话总结（应提炼可迁移认知，非复述）
2. misconceptions 中的每项是否有 evidence 支持（无证据的不应标记为 misconception）
3. 是否将探索性思考误判为误区（exploratory_thinking 和 misconception 要区分）`;

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
          misconceptions: [],
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      const misconceptions = Array.isArray(parsed.misconceptions)
        ? parsed.misconceptions.filter(
            (m: unknown) => typeof m === "object" && m !== null && typeof (m as Record<string, unknown>).item === "string"
          ).map((m: unknown) => {
            const obj = m as Record<string, unknown>;
            return {
              item: String(obj.item ?? ""),
              type: ["misconception", "hidden_assumption", "exploratory_thinking"].includes(String(obj.type ?? "")) ? String(obj.type) : "exploratory_thinking",
              evidence: String(obj.evidence ?? ""),
              correction: String(obj.correction ?? ""),
            };
          })
        : [];
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
        misconceptions,
      };
    } catch {
      return {
        key_decisions: [],
        turning_points: [],
        key_takeaways: [],
        summary: "复盘输出解析失败，返回默认结构",
        misconceptions: [],
      };
    }
  },
};
