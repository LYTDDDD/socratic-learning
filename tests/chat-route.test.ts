import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../app/api/chat/route";

vi.mock("../lib/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm")>();
  return {
    ...actual,
    callReviewModel: vi.fn(),
  };
});

import { callReviewModel } from "../lib/llm";

const mockCallReviewModel = vi.mocked(callReviewModel);

function makeNextRequest(body: unknown) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function makeValidPayload(overrides?: Record<string, unknown>) {
  return {
    message: "你好，请帮我分析一下",
    history: [],
    ...overrides,
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallReviewModel.mockResolvedValue("这是苏格拉底式回复");
  });

  it("returns reply and reviewTriggered false on success", async () => {
    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reply).toBe("这是苏格拉底式回复");
    expect(data.reviewTriggered).toBe(false);
    expect(data.error).toBeUndefined();
  });

  it("returns 400 when message is missing", async () => {
    const req = makeNextRequest({ history: [] });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("message");
    expect(data.reviewTriggered).toBe(false);
  });

  it("returns 400 when message is empty string", async () => {
    const req = makeNextRequest({ message: "   ", history: [] });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("message");
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    }) as unknown as import("next/server").NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("合法 JSON");
  });

  it("returns 500 when callReviewModel throws a generic error", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Model crashed"));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Model crashed");
    expect(data.reply).toBe("");
    expect(data.reviewTriggered).toBe(false);
  });

  it("returns correct status code when ModelCallError is thrown", async () => {
    const { ModelCallError } = await import("../lib/llm");
    mockCallReviewModel.mockRejectedValueOnce(new ModelCallError("Rate limited", 429));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Rate limited");
  });

  it("sets reviewTriggered true when message contains 复盘", async () => {
    const req = makeNextRequest(makeValidPayload({ message: "我想复盘一下" }));
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviewTriggered).toBe(true);
  });

  it("sets reviewTriggered true when message contains 结束", async () => {
    const req = makeNextRequest(makeValidPayload({ message: "结束对话" }));
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviewTriggered).toBe(true);
  });

  it("sets reviewTriggered true when message contains 保存", async () => {
    const req = makeNextRequest(makeValidPayload({ message: "保存记录" }));
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviewTriggered).toBe(true);
  });

  it("passes conversation context to callReviewModel", async () => {
    const payload = makeValidPayload({
      message: "帮我分析",
      history: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！有什么可以帮你的？" },
      ],
    });

    const req = makeNextRequest(payload);
    await POST(req);

    expect(mockCallReviewModel).toHaveBeenCalledOnce();
    const userPrompt = mockCallReviewModel.mock.calls[0][1];
    expect(userPrompt).toContain("用户：你好");
    expect(userPrompt).toContain("助手：你好！有什么可以帮你的？");
    expect(userPrompt).toContain("用户：帮我分析");
    expect(mockCallReviewModel.mock.calls[0][2]).toBe(req.signal);
  });
});
