import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../app/api/review/route";

vi.mock("../lib/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm")>();
  return {
    ...actual,
    callReviewModel: vi.fn(),
  };
});

vi.mock("../lib/extract-json", () => ({
  extractJsonFromOutput: vi.fn(),
}));

import { callReviewModel } from "../lib/llm";
import { extractJsonFromOutput } from "../lib/extract-json";

const mockCallReviewModel = vi.mocked(callReviewModel);
const mockExtractJsonFromOutput = vi.mocked(extractJsonFromOutput);

function makeNextRequest(body: unknown) {
  return new Request("http://localhost:3000/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function makeQuestionsPayload(overrides?: Record<string, unknown>) {
  return {
    phase: "questions",
    assetId: "asset_001",
    assetTitle: "测试资产",
    coreInsight: "核心洞察",
    originalJudgment: "原始判断",
    revisedJudgment: "修正判断",
    myUnderstanding: "我的理解",
    transferableValue: "可迁移价值",
    reviewQuestions: ["已有问题1"],
    maturity: "emerging",
    ...overrides,
  };
}

function makeFeedbackPayload(overrides?: Record<string, unknown>) {
  return {
    phase: "feedback",
    assetId: "asset_001",
    assetTitle: "测试资产",
    coreInsight: "核心洞察",
    originalJudgment: "原始判断",
    revisedJudgment: "修正判断",
    myUnderstanding: "我的理解",
    transferableValue: "可迁移价值",
    maturity: "emerging",
    questions: ["问题1", "问题2"],
    answers: ["回答1", "回答2"],
    ...overrides,
  };
}

describe("POST /api/review — questions phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallReviewModel.mockResolvedValue("raw review output");
    mockExtractJsonFromOutput.mockReturnValue({
      success: true,
      json: { questions: ["新问题1", "新问题2", "新问题3"] },
    });
  });

  it("returns questions on success", async () => {
    const req = makeNextRequest(makeQuestionsPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.phase).toBe("questions");
    expect(data.questions).toEqual(["新问题1", "新问题2", "新问题3"]);
    expect(data.error).toBeNull();
  });

  it("returns 400 when assetId is missing", async () => {
    const req = makeNextRequest(makeQuestionsPayload({ assetId: "" }));

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("assetId");
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const req = new Request("http://localhost:3000/api/review", {
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

    const req = makeNextRequest(makeQuestionsPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Model crashed");
    expect(data.phase).toBe("questions");
    expect(data.questions).toEqual([]);
  });

  it("returns correct status code when ModelCallError is thrown", async () => {
    const { ModelCallError } = await import("../lib/llm");
    mockCallReviewModel.mockRejectedValueOnce(new ModelCallError("Rate limited", 429));

    const req = makeNextRequest(makeQuestionsPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Rate limited");
  });

  it("returns error when JSON extraction fails", async () => {
    mockExtractJsonFromOutput.mockReturnValueOnce({
      success: false,
      error: "未找到可解析的 JSON 内容。",
    });

    const req = makeNextRequest(makeQuestionsPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("未找到可解析的 JSON 内容");
  });
});

describe("POST /api/review — feedback phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallReviewModel.mockResolvedValue("raw feedback output");
    mockExtractJsonFromOutput.mockReturnValue({
      success: true,
      json: {
        feedback: [
          { question: "问题1", answer: "回答1", evaluation: "good", comment: "理解到位" },
          { question: "问题2", answer: "回答2", evaluation: "partial", comment: "部分理解" },
        ],
        overallAssessment: "整体表现不错",
        maturitySuggestion: {
          current: "emerging",
          suggested: "developing",
          reason: "回答质量有明显提升",
        },
      },
    });
  });

  it("returns feedback on success", async () => {
    const req = makeNextRequest(makeFeedbackPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.phase).toBe("feedback");
    expect(data.feedback).toHaveLength(2);
    expect(data.feedback[0].evaluation).toBe("good");
    expect(data.feedback[1].evaluation).toBe("partial");
    expect(data.overallAssessment).toBe("整体表现不错");
    expect(data.maturitySuggestion).toEqual({
      current: "emerging",
      suggested: "developing",
      reason: "回答质量有明显提升",
    });
    expect(data.error).toBeNull();
  });

  it("returns 400 when assetId is missing", async () => {
    const req = makeNextRequest(makeFeedbackPayload({ assetId: "" }));

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("assetId");
  });

  it("returns 400 when feedback phase has no questions", async () => {
    const req = makeNextRequest(makeFeedbackPayload({ questions: [] }));

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("评估问题");
  });

  it("returns 500 when callReviewModel throws a generic error", async () => {
    mockCallReviewModel.mockRejectedValueOnce(new Error("Model crashed"));

    const req = makeNextRequest(makeFeedbackPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Model crashed");
    expect(data.phase).toBe("feedback");
    expect(data.feedback).toEqual([]);
  });

  it("returns correct status code when ModelCallError is thrown", async () => {
    const { ModelCallError } = await import("../lib/llm");
    mockCallReviewModel.mockRejectedValueOnce(new ModelCallError("Rate limited", 429));

    const req = makeNextRequest(makeFeedbackPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Rate limited");
  });

  it("defaults invalid evaluation to partial", async () => {
    mockExtractJsonFromOutput.mockReturnValueOnce({
      success: true,
      json: {
        feedback: [
          { question: "问题1", answer: "回答1", evaluation: "invalid_val", comment: "测试" },
        ],
        overallAssessment: "测试",
        maturitySuggestion: null,
      },
    });

    const req = makeNextRequest(makeFeedbackPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.feedback[0].evaluation).toBe("partial");
  });

  it("handles null maturitySuggestion", async () => {
    mockExtractJsonFromOutput.mockReturnValueOnce({
      success: true,
      json: {
        feedback: [
          { question: "问题1", answer: "回答1", evaluation: "good", comment: "不错" },
        ],
        overallAssessment: "表现良好",
        maturitySuggestion: null,
      },
    });

    const req = makeNextRequest(makeFeedbackPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.maturitySuggestion).toBeNull();
  });
});
