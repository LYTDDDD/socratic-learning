import type { AgentDefinition, AgentContext } from "./agent-types";
import { callReviewModel } from "./llm";

const DEPTH_EVALUATION_SYSTEM_PROMPT = `你是一个认知深度评估器（DepthEvaluationAgent）。你的职责是评估对话的认知深度，识别盲点和改进方向。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "depth_score": 5,
  "blind_spots": ["盲点1", "盲点2"],
  "improvement_directions": ["改进方向1", "改进方向2"],
  "reasoning": "评估理由"
}

规则：
- depth_score：1-10 的整数，1 表示极浅（仅表面信息交换），10 表示极深（触及本质、引发范式转变）
- blind_spots：列出对话中未深入探讨或完全忽略的重要角度
- improvement_directions：列出可以提升认知深度的具体方向
- reasoning：说明评分和识别盲点的依据
- blind_spots 和 improvement_directions 各至少一项，最多五项
- 只输出 JSON，不要输出其他内容`;

export const depthEvaluationAgent: AgentDefinition = {
  type: "depth_evaluation",
  name: "DepthEvaluationAgent",
  description: "评估认知深度、盲点和改进方向",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const reviewStep = context.previousSteps.find(
      (s) => s.agent === "review" && s.status === "success" && s.output,
    );
    const reviewContext = reviewStep?.output
      ? `\n\n复盘结果上下文：${JSON.stringify(reviewStep.output)}`
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
      reviewContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await callReviewModel(
      DEPTH_EVALUATION_SYSTEM_PROMPT,
      userPrompt,
    );

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          depth_score: 1,
          blind_spots: [],
          improvement_directions: [],
          reasoning: "无法解析深度评估输出，返回默认结构",
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        depth_score:
          typeof parsed.depth_score === "number"
            ? Math.min(10, Math.max(1, Math.round(parsed.depth_score)))
            : 1,
        blind_spots: Array.isArray(parsed.blind_spots)
          ? parsed.blind_spots
          : [],
        improvement_directions: Array.isArray(parsed.improvement_directions)
          ? parsed.improvement_directions
          : [],
        reasoning:
          typeof parsed.reasoning === "string"
            ? parsed.reasoning
            : "深度评估输出缺少理由字段",
      };
    } catch {
      return {
        depth_score: 1,
        blind_spots: [],
        improvement_directions: [],
        reasoning: "深度评估输出解析失败，返回默认结构",
      };
    }
  },
};
