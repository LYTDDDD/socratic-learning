import { NextRequest, NextResponse } from "next/server";
import { callReviewModel, ModelCallError } from "../../../lib/llm";
import { extractJsonFromOutput } from "../../../lib/extract-json";

export type ReviewPhase = "questions" | "feedback";

export type ReviewQuestionsRequest = {
  phase: "questions";
  assetId: string;
  assetTitle: string;
  coreInsight: string;
  originalJudgment: string;
  revisedJudgment: string;
  myUnderstanding: string;
  transferableValue: string;
  reviewQuestions: string[];
  maturity: string;
};

export type ReviewFeedbackRequest = {
  phase: "feedback";
  assetId: string;
  assetTitle: string;
  coreInsight: string;
  originalJudgment: string;
  revisedJudgment: string;
  myUnderstanding: string;
  transferableValue: string;
  maturity: string;
  questions: string[];
  answers: string[];
};

export type ReviewRequest = ReviewQuestionsRequest | ReviewFeedbackRequest;

export type ReviewQuestionsResponse = {
  phase: "questions";
  questions: string[];
  error: null | string;
};

export type ReviewFeedbackResponse = {
  phase: "feedback";
  feedback: Array<{
    question: string;
    answer: string;
    evaluation: "good" | "partial" | "needs_work";
    comment: string;
  }>;
  overallAssessment: string;
  maturitySuggestion: null | {
    current: string;
    suggested: string;
    reason: string;
  };
  error: null | string;
};

export type ReviewResponse = ReviewQuestionsResponse | ReviewFeedbackResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStr(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

function readStrArray(input: Record<string, unknown>, key: string): string[] {
  const value = input[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function parseReviewRequest(payload: unknown): ReviewRequest {
  const input = isRecord(payload) ? payload : {};
  const phase = readStr(input, "phase");
  const assetId = readStr(input, "assetId");

  if (phase === "feedback") {
    return {
      phase: "feedback",
      assetId,
      assetTitle: readStr(input, "assetTitle"),
      coreInsight: readStr(input, "coreInsight"),
      originalJudgment: readStr(input, "originalJudgment"),
      revisedJudgment: readStr(input, "revisedJudgment"),
      myUnderstanding: readStr(input, "myUnderstanding"),
      transferableValue: readStr(input, "transferableValue"),
      maturity: readStr(input, "maturity"),
      questions: readStrArray(input, "questions"),
      answers: readStrArray(input, "answers"),
    };
  }

  return {
    phase: "questions",
    assetId,
    assetTitle: readStr(input, "assetTitle"),
    coreInsight: readStr(input, "coreInsight"),
    originalJudgment: readStr(input, "originalJudgment"),
    revisedJudgment: readStr(input, "revisedJudgment"),
    myUnderstanding: readStr(input, "myUnderstanding"),
    transferableValue: readStr(input, "transferableValue"),
    reviewQuestions: readStrArray(input, "reviewQuestions"),
    maturity: readStr(input, "maturity"),
  };
}

const REVIEW_SYSTEM_PROMPT = `你是一位苏格拉底式学习伙伴。你的职责是帮助用户检验对认知资产的理解程度。
你不会直接告诉答案，而是通过评估性问题引导用户思考和自我检验。
你的反馈应当具体、有建设性，指出理解到位的地方和需要补充的地方。
所有输出必须为 JSON 格式。`;

function buildQuestionsUserPrompt(req: ReviewQuestionsRequest): string {
  return `用户正在复习一张认知资产卡，请基于以下资产内容生成 2-3 个评估性问题，帮助测试用户是否真正理解了这张卡的核心内容。

评估问题应该：
- 不直接问定义，而是问"在 X 场景下你会怎么用"
- 测试用户能否区分原始判断和修正后判断
- 测试用户能否举出新例子

资产信息：
- 标题：${req.assetTitle}
- 核心洞察：${req.coreInsight}
- 原始判断：${req.originalJudgment}
- 修正后判断：${req.revisedJudgment}
- 我的理解：${req.myUnderstanding}
- 可迁移价值：${req.transferableValue}
- 当前成熟度：${req.maturity}
- 已有复习问题：${req.reviewQuestions.join("；")}

请输出 JSON 格式：
{"questions": ["问题1", "问题2", "问题3"]}

只输出 JSON，不要输出其他内容。`;
}

function buildFeedbackUserPrompt(req: ReviewFeedbackRequest): string {
  const qaPairs = req.questions
    .map((q, i) => `问题：${q}\n回答：${req.answers[i] ?? "（未回答）"}`)
    .join("\n\n");

  return `用户正在复习一张认知资产卡，已回答了评估问题。请对每个回答给出反馈，并给出整体评估。

资产信息：
- 标题：${req.assetTitle}
- 核心洞察：${req.coreInsight}
- 原始判断：${req.originalJudgment}
- 修正后判断：${req.revisedJudgment}
- 我的理解：${req.myUnderstanding}
- 可迁移价值：${req.transferableValue}
- 当前成熟度：${req.maturity}

${qaPairs}

请输出 JSON 格式：
{
  "feedback": [
    {"question": "问题", "answer": "回答", "evaluation": "good|partial|needs_work", "comment": "具体反馈"}
  ],
  "overallAssessment": "整体评估文字",
  "maturitySuggestion": null 或 {"current": "当前成熟度", "suggested": "建议成熟度", "reason": "原因"}
}

evaluation 只能是 good（理解到位）、partial（部分理解）、needs_work（需要补充）。
maturitySuggestion 只在用户表现明显超出当前成熟度时才建议升级，否则为 null。
只输出 JSON，不要输出其他内容。`;
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { phase: "questions", questions: [], error: "请求体必须是合法 JSON。" } as ReviewQuestionsResponse,
      { status: 400 },
    );
  }

  const req = parseReviewRequest(payload);

  if (!req.assetId) {
    return NextResponse.json(
      { phase: "questions", questions: [], error: "缺少 assetId。" } as ReviewQuestionsResponse,
      { status: 400 },
    );
  }

  if (req.phase === "feedback" && req.questions.length === 0) {
    return NextResponse.json(
      { phase: "feedback", feedback: [], overallAssessment: "", maturitySuggestion: null, error: "feedback 阶段缺少评估问题。" } as ReviewFeedbackResponse,
      { status: 400 },
    );
  }

  try {
    const userPrompt = req.phase === "questions"
      ? buildQuestionsUserPrompt(req as ReviewQuestionsRequest)
      : buildFeedbackUserPrompt(req as ReviewFeedbackRequest);

    const raw = await callReviewModel(REVIEW_SYSTEM_PROMPT, userPrompt);
    const extracted = extractJsonFromOutput(raw);

    if (!extracted.success || !extracted.json) {
      throw new Error(extracted.error ?? "AI 返回格式异常，无法解析 JSON。");
    }

    const parsed = extracted.json as Record<string, unknown>;

    if (req.phase === "questions") {
      const questions = Array.isArray(parsed.questions)
        ? (parsed.questions as unknown[]).filter((q): q is string => typeof q === "string")
        : [];
      return NextResponse.json({
        phase: "questions",
        questions,
        error: null,
      } as ReviewQuestionsResponse);
    }

    const validEvaluations = new Set(["good", "partial", "needs_work"]);
    const feedback = Array.isArray(parsed.feedback)
      ? (parsed.feedback as Array<Record<string, unknown>>).map((f) => ({
          question: String(f.question ?? ""),
          answer: String(f.answer ?? ""),
          evaluation: validEvaluations.has(String(f.evaluation ?? "")) ? String(f.evaluation) as "good" | "partial" | "needs_work" : "partial",
          comment: String(f.comment ?? ""),
        }))
      : [];

    const ms = parsed.maturitySuggestion as Record<string, unknown> | null | undefined;

    return NextResponse.json({
      phase: "feedback",
      feedback,
      overallAssessment: String(parsed.overallAssessment ?? ""),
      maturitySuggestion: ms
        ? {
            current: String(ms.current ?? req.maturity),
            suggested: String(ms.suggested ?? req.maturity),
            reason: String(ms.reason ?? ""),
          }
        : null,
      error: null,
    } as ReviewFeedbackResponse);
  } catch (error) {
    const status = error instanceof ModelCallError && error.status ? error.status : 500;
    const errorMessage = error instanceof Error ? error.message : "模型调用失败";
    console.error("Review model call failed:", errorMessage);

    if (req.phase === "questions") {
      return NextResponse.json(
        { phase: "questions", questions: [], error: errorMessage } as ReviewQuestionsResponse,
        { status },
      );
    }
    return NextResponse.json(
      {
        phase: "feedback",
        feedback: [],
        overallAssessment: "",
        maturitySuggestion: null,
        error: errorMessage,
      } as ReviewFeedbackResponse,
      { status },
    );
  }
}
