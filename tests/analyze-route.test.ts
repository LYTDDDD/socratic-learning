import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../app/api/analyze/route";

vi.mock("../lib/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm")>();
  return {
    ...actual,
    callAnalysisModel: vi.fn(),
    getModelConfig: () => ({ model: "test-model" }),
  };
});

vi.mock("../lib/extract-json", () => ({
  extractJsonFromOutput: vi.fn(),
}));

vi.mock("../lib/prompt", () => ({
  OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION: "offline-mission-analysis-v0.2",
  readOfflineMissionAnalysisPrompt: vi.fn().mockResolvedValue("test prompt"),
}));

import { callAnalysisModel } from "../lib/llm";
import { extractJsonFromOutput } from "../lib/extract-json";

const mockCallAnalysisModel = vi.mocked(callAnalysisModel);
const mockExtractJsonFromOutput = vi.mocked(extractJsonFromOutput);

function makeNextRequest(body: unknown) {
  return new Request("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

function makeValidPayload(overrides?: Record<string, unknown>) {
  return {
    background: "test background",
    originalGoal: "test goal",
    conversation: "test conversation",
    notes: "test notes",
    expectedOutput: "test output",
    preferenceRules: [],
    ...overrides,
  };
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAnalysisModel.mockResolvedValue("raw model output");
    mockExtractJsonFromOutput.mockReturnValue({
      success: true,
      json: { mission_review: "test review" },
      markdown: "## 分析报告",
    });
  });

  it("returns 200 with markdown/json/raw/parseStatus on success", async () => {
    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.parseStatus).toBe("success");
    expect(data.error).toBeNull();
    expect(data.json).toEqual({ mission_review: "test review" });
    expect(data.markdown).toBe("## 分析报告");
    expect(data.raw).toBe("raw model output");
    expect(data.runLog).not.toBeNull();
    expect(data.runLog.request_status).toBe("success");
    expect(data.runLog.parse_status).toBe("success");
    expect(data.runLog.model_name).toBe("test-model");
  });

  it("returns 400 when originalGoal is missing", async () => {
    const req = makeNextRequest({
      background: "bg",
      conversation: "conv",
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("originalGoal");
    expect(data.parseStatus).toBe("not_attempted");
  });

  it("returns 400 when conversation is missing", async () => {
    const req = makeNextRequest({
      background: "bg",
      originalGoal: "goal",
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("conversation");
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const req = new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    }) as unknown as import("next/server").NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("合法 JSON");
    expect(data.parseStatus).toBe("not_attempted");
    expect(data.runLog.request_status).toBe("error");
  });

  it("returns 500 when callAnalysisModel throws a generic error", async () => {
    mockCallAnalysisModel.mockRejectedValueOnce(new Error("Model crashed"));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("模型调用失败");
    expect(data.parseStatus).toBe("not_attempted");
    expect(data.runLog.request_status).toBe("failed");
  });

  it("returns correct status code when ModelCallError is thrown", async () => {
    const { ModelCallError } = await import("../lib/llm");
    mockCallAnalysisModel.mockRejectedValueOnce(new ModelCallError("Rate limited", 429));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("模型调用失败");
  });

  it("returns parseStatus failed when JSON extraction fails", async () => {
    mockExtractJsonFromOutput.mockReturnValue({
      success: false,
      error: "未找到可解析的 JSON 内容。",
    });

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.parseStatus).toBe("failed");
    expect(data.json).toBeNull();
    expect(data.error).toBe("未找到可解析的 JSON 内容。");
    expect(data.runLog.request_status).toBe("success");
    expect(data.runLog.parse_status).toBe("failed");
  });

  it("retries with ANALYZE_PARSE_RETRIES when first extraction fails", async () => {
    const originalEnv = process.env.ANALYZE_PARSE_RETRIES;
    process.env.ANALYZE_PARSE_RETRIES = "1";

    mockCallAnalysisModel
      .mockResolvedValueOnce("first raw output")
      .mockResolvedValueOnce("retry raw output");

    mockExtractJsonFromOutput
      .mockReturnValueOnce({ success: false, error: "parse failed" })
      .mockReturnValueOnce({
        success: true,
        json: { mission_review: "retry result" },
        markdown: "## 重试报告",
      });

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.parseStatus).toBe("success");
    expect(data.json).toEqual({ mission_review: "retry result" });
    expect(mockCallAnalysisModel).toHaveBeenCalledTimes(2);

    process.env.ANALYZE_PARSE_RETRIES = originalEnv;
  });

  it("includes runLog with correct fields in successful response", async () => {
    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(data.runLog.run_id).toBeTruthy();
    expect(data.runLog.run_id.startsWith("run_")).toBe(true);
    expect(data.runLog.created_at).toBeTruthy();
    expect(data.runLog.prompt_version).toBe("offline-mission-analysis-v0.2");
    expect(data.runLog.duration_ms).toBeGreaterThanOrEqual(0);
    expect(data.runLog.error_message).toBeNull();
  });
});
