import type { AgentDefinition, AgentContext } from "./agent-types";
import { ASSET_TYPE_MAP } from "./agent-types";
import { buildPreviousStepsContext, buildPreferenceRulesSection } from "./agent-utils";
import { callReviewModel } from "./llm";

const CARD_STRING_FIELDS: Record<string, string[]> = {
  ConceptCard: ["definition", "boundary"],
  MisconceptionCard: ["misconception_trigger", "correction_path", "future_warning", "related_correct_concept"],
  MethodCard: ["when_to_use"],
  CaseCard: ["background", "decision_point", "outcome", "key_lesson"],
  ReflectionCard: ["trigger_question", "insight", "mindset_shift", "application_scenario"],
};

const CARD_ARRAY_FIELDS: Record<string, string[]> = {
  ConceptCard: ["common_confusions", "examples"],
  MethodCard: ["steps", "pitfalls", "prerequisites"],
};

const ASSET_SYSTEM_PROMPT = `你是一个认知资产提取智能体（AssetAgent）。你的职责是判断对话是否包含值得保存的认知资产，如果值得则提取。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "has_asset": true/false,
  "asset_type": "推荐资产类型（principle/mental_model/checklist/framework/insight/misconception/case）",
  "title": "资产标题",
  "core_insight": "核心洞察",
  "original_judgment": "原始判断",
  "revised_judgment": "修正后判断",
  "my_understanding": "我的理解",
  "transferable_value": "可迁移价值",
  "reasoning": "判断理由"
}

当 has_asset 为 true 时，根据 asset_type 额外输出以下专属字段：

当 asset_type 为 principle 或 mental_model 时（概念卡片），额外输出：
"definition": "精确定义",
"boundary": "适用边界",
"common_confusions": ["常见混淆1", "常见混淆2"],
"examples": ["具体案例1", "具体案例2"]

当 asset_type 为 misconception 时（误区卡片），额外输出：
"misconception_trigger": "触发条件",
"correction_path": "纠正路径",
"future_warning": "未来警示",
"related_correct_concept": "相关正确概念"

当 asset_type 为 checklist 或 framework 时（方法卡片），额外输出：
"when_to_use": "使用时机",
"steps": ["步骤1", "步骤2"],
"pitfalls": ["陷阱1", "陷阱2"],
"prerequisites": ["前置条件1", "前置条件2"]

当 asset_type 为 case 时（案例卡片），额外输出：
"background": "背景描述",
"decision_point": "决策节点",
"outcome": "结果",
"key_lesson": "核心教训"

当 asset_type 为 insight 时（反思卡片），额外输出：
"trigger_question": "触发问题",
"insight": "核心洞察",
"mindset_shift": "思维转变",
"application_scenario": "应用场景"

规则：
- 如果对话中没有值得保存的认知资产，has_asset 设为 false，其他字段可以为空字符串
- asset_type 只能是 principle、mental_model、checklist、framework、insight、misconception、case 之一
- core_insight 应简洁有力，一至两句话概括
- transferable_value 应说明该资产在什么场景下可以复用
- 专属字段应尽可能完整填写，提供有价值的信息
- 只输出 JSON，不要输出其他内容

输出前自检：
1. has_asset=true 时，core_insight 是否可迁移到其他场景（不能只适用于当前对话）
2. has_asset=true 时，original_judgment 和 revised_judgment 是否有实质区别（无变化不应提取资产）
3. has_asset=true 时，是否根据 asset_type 输出了对应的专属字段
4. has_asset=false 时，reasoning 是否解释了为什么不值得提取`;

export const assetAgent: AgentDefinition = {
  type: "asset",
  name: "AssetAgent",
  description: "判断是否值得提取认知资产，如果值得则提取",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const sections = [
      `Background: ${context.input.background}`,
      `Original Goal: ${context.input.originalGoal}`,
      `Conversation (first 4000 chars): ${context.input.conversation.slice(0, 4000)}`,
      `Notes: ${context.input.notes}`,
      `Expected Output: ${context.input.expectedOutput}`,
    ];

    const prevCtx = buildPreviousStepsContext(context.previousSteps, ["review", "depth_evaluation"]);
    if (prevCtx) {
      sections.push(`\n前序步骤输出：\n${prevCtx}`);
    }

    const rulesSection = buildPreferenceRulesSection(context.input.preferenceRules, "判断和提取");
    if (rulesSection) {
      sections.push(rulesSection);
    }

    const userPrompt = sections.join("\n\n");
    const raw = await callReviewModel(ASSET_SYSTEM_PROMPT, userPrompt, context.signal);

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
      const assetType = typeof parsed.asset_type === "string" ? parsed.asset_type : "";
      const cardType = ASSET_TYPE_MAP[assetType] ?? "ConceptCard";
      const stringFields = CARD_STRING_FIELDS[cardType] ?? [];
      const arrayFields = CARD_ARRAY_FIELDS[cardType] ?? [];
      const specialFields: Record<string, unknown> = {};

      for (const field of stringFields) {
        if (typeof parsed[field] === "string") specialFields[field] = parsed[field];
      }
      for (const field of arrayFields) {
        if (Array.isArray(parsed[field])) specialFields[field] = parsed[field].filter((v: unknown) => typeof v === "string");
      }

      const result: Record<string, unknown> = {
        has_asset: typeof parsed.has_asset === "boolean" ? parsed.has_asset : false,
        asset_type: assetType,
        title: typeof parsed.title === "string" ? parsed.title : "",
        core_insight: typeof parsed.core_insight === "string" ? parsed.core_insight : "",
        original_judgment: typeof parsed.original_judgment === "string" ? parsed.original_judgment : "",
        revised_judgment: typeof parsed.revised_judgment === "string" ? parsed.revised_judgment : "",
        my_understanding: typeof parsed.my_understanding === "string" ? parsed.my_understanding : "",
        transferable_value: typeof parsed.transferable_value === "string" ? parsed.transferable_value : "",
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      };

      if (Object.keys(specialFields).length > 0) {
        result.special_fields = specialFields;
      }

      return result;
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
