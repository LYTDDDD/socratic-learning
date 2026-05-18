import { NextRequest, NextResponse } from "next/server";
import { callReviewModel, ModelCallError } from "../../../lib/llm";

const CHAT_SYSTEM_PROMPT =
  "你是一个苏格拉底式学习伙伴。你的角色是通过提问引导用户深入思考，而不是直接给答案。\n当用户说\"复盘\"、\"结束\"或\"保存\"时，你应该总结本次对话的关键收获。";

const REVIEW_KEYWORDS = ["复盘", "结束", "保存"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseChatInput(payload: unknown) {
  const input = isRecord(payload) ? payload : {};
  return {
    message: typeof input.message === "string" ? input.message : "",
    history: Array.isArray(input.history)
      ? input.history.filter(
          (item): item is { role: string; content: string } =>
            item !== null &&
            typeof item === "object" &&
            typeof (item as { role: unknown }).role === "string" &&
            typeof (item as { content: unknown }).content === "string",
        )
      : [],
  };
}

function buildConversationContext(
  history: Array<{ role: string; content: string }>,
  currentUserMessage: string,
): string {
  const lines = history.map(
    (m) => `${m.role === "user" ? "用户" : "助手"}：${m.content}`,
  );
  lines.push(`用户：${currentUserMessage}`);
  return lines.join("\n\n");
}

function containsReviewKeyword(message: string): boolean {
  return REVIEW_KEYWORDS.some((kw) => message.includes(kw));
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { reply: "", reviewTriggered: false, error: "请求体必须是合法 JSON。" },
      { status: 400 },
    );
  }

  const { message, history } = parseChatInput(payload);

  if (!message.trim()) {
    return NextResponse.json(
      { reply: "", reviewTriggered: false, error: "缺少必填字段：message。" },
      { status: 400 },
    );
  }

  const context = buildConversationContext(history, message);

  try {
    const reply = await callReviewModel(CHAT_SYSTEM_PROMPT, context, request.signal);
    const reviewTriggered = containsReviewKeyword(message);

    return NextResponse.json({
      reply,
      reviewTriggered,
    });
  } catch (error) {
    const status =
      error instanceof ModelCallError && error.status ? error.status : 500;
    const errorMessage =
      error instanceof Error ? error.message : "模型调用失败";
    console.error("Chat model call failed:", errorMessage);

    return NextResponse.json(
      { reply: "", reviewTriggered: false, error: errorMessage },
      { status },
    );
  }
}
