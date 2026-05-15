import type { AgentDefinition, AgentContext, AgentStep } from "./agent-types";
import { callReviewModel } from "./llm";

const ASSET_SYSTEM_PROMPT = `你是一个认知资产提取智能体（AssetAgent）。你的职责是判断对话是否包含值得保存的认知资产，如果值得则提取。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "has_asset": true/false,
  "asset_type": "推荐资产类型（principle/mental_model/checklist/framework/insight）",
  "title": "资产标题",
  "core_insight": "核心洞察",
  "original_judgment": "原始判断",
  "revised_judgment": "修正后判断",
  "my_understanding": "我的理解",
  "transferable_value": "可迁移价值",
  "reasoning": "判断理由"
}

规则：
- 如果对话中没有值得保存的认知资产，has_asset 设为 false，其他字段可以为空字符串
- asset_type 只能是 principle、mental_model、checklist、framework、insight 之一
- core_insight 应简洁有力，一至两句话概括
- transferable_value 应说明该资产在什么场景下可以复用
- 只输出 JSON，不要输出其他内容`;

function buildPreviousStepsContext(previousSteps: AgentStep[]): string {
  const relevant = previousSteps.filter(
    (s) => s.agent === "review" || s.agent === "depth_evaluation",
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
    "以下是用户已确认的偏好规则，请在判断和提取时参考：",
    "",
    ...rules.map((rule, i) => `${i + 1}. ${rule}`),
  ].join("\n");
}

export const assetAgent: AgentDefinition = {
  type: "asset",
  name: "AssetAgent",
  description: "判断是否值得提取认知资产，如果值得则提取",
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
    const raw = await callReviewModel(ASSET_SYSTEM_PROMPT, userPrompt);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          has_asset: false,
          asset_type: "",
          title: "",
          core_insight: "",
          original_judgment: "",
          revised_judgment: "",
          my_understanding: "",
          transferable_value: "",
          reasoning: "无法解析 AssetAgent 输出",
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        has_asset: typeof parsed.has_asset === "boolean" ? parsed.has_asset : false,
        asset_type: typeof parsed.asset_type === "string" ? parsed.asset_type : "",
        title: typeof parsed.title === "string" ? parsed.title : "",
        core_insight: typeof parsed.core_insight === "string" ? parsed.core_insight : "",
        original_judgment: typeof parsed.original_judgment === "string" ? parsed.original_judgment : "",
        revised_judgment: typeof parsed.revised_judgment === "string" ? parsed.revised_judgment : "",
        my_understanding: typeof parsed.my_understanding === "string" ? parsed.my_understanding : "",
        transferable_value: typeof parsed.transferable_value === "string" ? parsed.transferable_value : "",
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      };
    } catch {
      return {
        has_asset: false,
        asset_type: "",
        title: "",
        core_insight: "",
        original_judgment: "",
        revised_judgment: "",
        my_understanding: "",
        transferable_value: "",
        reasoning: "AssetAgent 输出解析失败",
      };
    }
  },
};
