import type { AgentDefinition, AgentContext, DepthDimensions, DimensionScore } from "./agent-types";
import { callReviewModel } from "./llm";

const VALID_UNCERTAINTIES = ["low", "medium", "high"];

const DIMENSION_KEYS = [
  "judgment_shift",
  "boundary_clarity",
  "transferability",
  "hidden_assumption",
  "counterexample_awareness",
  "framework_formation",
  "behavior_impact",
] as const;

function parseDimensionScore(raw: unknown): DimensionScore {
  if (typeof raw !== "object" || raw === null) {
    return { score: 5, evidence: "", uncertainty: "medium" };
  }
  const d = raw as Record<string, unknown>;
  return {
    score:
      typeof d.score === "number"
        ? Math.min(10, Math.max(1, Math.round(d.score)))
        : 5,
    evidence: typeof d.evidence === "string" ? d.evidence : "",
    uncertainty: VALID_UNCERTAINTIES.includes(d.uncertainty as string)
      ? (d.uncertainty as DimensionScore["uncertainty"])
      : "medium",
  };
}

function computeWeightedDepthScore(dimensions: DepthDimensions): number {
  const weights: Record<string, number> = {
    judgment_shift: 1.5,
    boundary_clarity: 1.0,
    transferability: 1.5,
    hidden_assumption: 1.0,
    counterexample_awareness: 1.0,
    framework_formation: 1.0,
    behavior_impact: 1.0,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of DIMENSION_KEYS) {
    const w = weights[key];
    weightedSum += dimensions[key].score * w;
    totalWeight += w;
  }
  return Math.min(10, Math.max(1, Math.round(weightedSum / totalWeight)));
}

const DEPTH_EVALUATION_SYSTEM_PROMPT = `你是一个认知深度评估器（DepthEvaluationAgent）。你的职责是评估对话的认知深度，识别盲点和改进方向。

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "dimensions": {
    "judgment_shift": { "score": 1-10, "evidence": "来自对话的证据", "uncertainty": "low|medium|high" },
    "boundary_clarity": { "score": 1-10, "evidence": "...", "uncertainty": "low|medium|high" },
    "transferability": { "score": 1-10, "evidence": "...", "uncertainty": "low|medium|high" },
    "hidden_assumption": { "score": 1-10, "evidence": "...", "uncertainty": "low|medium|high" },
    "counterexample_awareness": { "score": 1-10, "evidence": "...", "uncertainty": "low|medium|high" },
    "framework_formation": { "score": 1-10, "evidence": "...", "uncertainty": "low|medium|high" },
    "behavior_impact": { "score": 1-10, "evidence": "...", "uncertainty": "low|medium|high" }
  },
  "blind_spots": ["盲点1", "盲点2"],
  "improvement_directions": ["改进方向1", "改进方向2"],
  "reasoning": "评估理由"
}

维度评分规则：
- judgment_shift：是否识别并修正了错误判断？1=无修正，10=明确修正并有反思
- boundary_clarity：是否明确了适用范围？1=泛泛而谈，10=精确边界和例外
- transferability：洞察是否可迁移？1=仅适用当前场景，10=可广泛迁移
- hidden_assumption：是否识别隐藏假设？1=未识别，10=深入挖掘并验证
- counterexample_awareness：是否考虑反例？1=无视对立，10=主动寻找并分析
- framework_formation：是否形成思维框架？1=零散观点，10=结构化框架
- behavior_impact：是否产生行为改变？1=纯认知，10=明确可执行的改变

depth_score 为 7 个维度分数的加权平均（judgment_shift 和 transferability 权重 1.5，其余权重 1.0）

规则：
- blind_spots：列出对话中未深入探讨或完全忽略的重要角度
- improvement_directions：列出可以提升认知深度的具体方向
- reasoning：说明评分和识别盲点的依据
- blind_spots 和 improvement_directions 各至少一项，最多五项
- evidence 必须引用对话中的具体内容
- 只输出 JSON，不要输出其他内容

输出前自检：
1. 各维度 score >= 7 时，evidence 是否包含具体引用
2. 各维度 score <= 3 时，是否在 improvement_directions 中给出了具体改进方向
3. reasoning 是否包含对话中的具体引用（不能泛泛而谈）
4. uncertainty 为 high 时是否说明了不确定性来源`;

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
      context.signal,
    );

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        const defaultDimensions: DepthDimensions = {} as DepthDimensions;
        for (const key of DIMENSION_KEYS) {
          defaultDimensions[key] = { score: 5, evidence: "", uncertainty: "medium" };
        }
        return {
          depth_score: 1,
          dimensions: defaultDimensions,
          blind_spots: [],
          improvement_directions: [],
          reasoning: "无法解析深度评估输出，返回默认结构",
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);

      const dimensions: DepthDimensions = {} as DepthDimensions;
      if (typeof parsed.dimensions === "object" && parsed.dimensions !== null) {
        for (const key of DIMENSION_KEYS) {
          dimensions[key] = parseDimensionScore(
            (parsed.dimensions as Record<string, unknown>)[key],
          );
        }
      } else {
        for (const key of DIMENSION_KEYS) {
          dimensions[key] = { score: 5, evidence: "", uncertainty: "medium" };
        }
      }

      const computedDepthScore = computeWeightedDepthScore(dimensions);

      return {
        depth_score: computedDepthScore,
        dimensions,
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
      const defaultDimensions: DepthDimensions = {} as DepthDimensions;
      for (const key of DIMENSION_KEYS) {
        defaultDimensions[key] = { score: 5, evidence: "", uncertainty: "medium" };
      }
      return {
        depth_score: 1,
        dimensions: defaultDimensions,
        blind_spots: [],
        improvement_directions: [],
        reasoning: "深度评估输出解析失败，返回默认结构",
      };
    }
  },
};
