import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../app/api/analyze-agents/route";
import type { AgentStep } from "../lib/agent-types";

vi.mock("../lib/agent-pipeline", () => ({
  runAgentPipeline: vi.fn(),
  buildMultiAgentJson: vi.fn(),
  buildMultiAgentMarkdown: vi.fn(),
}));

vi.mock("../lib/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm")>();
  return {
    ...actual,
    getModelConfig: () => ({ model: "test-model" }),
  };
});

import { runAgentPipeline, buildMultiAgentJson, buildMultiAgentMarkdown } from "../lib/agent-pipeline";

const mockRunAgentPipeline = vi.mocked(runAgentPipeline);
const mockBuildMultiAgentJson = vi.mocked(buildMultiAgentJson);
const mockBuildMultiAgentMarkdown = vi.mocked(buildMultiAgentMarkdown);

function makeNextRequest(body: unknown) {
  return new Request("http://localhost:3000/api/analyze-agents", {
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

const mockSteps: AgentStep[] = [
  {
    agent: "supervisor",
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: "2026-01-01T00:00:01Z",
    input: {},
    output: { steps: ["review"], reasoning: "test" },
    status: "success",
    error: null,
  },
  {
    agent: "review",
    startedAt: "2026-01-01T00:00:01Z",
    finishedAt: "2026-01-01T00:00:02Z",
    input: {},
    output: { summary: "test" },
    status: "success",
    error: null,
  },
];

describe("POST /api/analyze-agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunAgentPipeline.mockResolvedValue({
      steps: mockSteps,
      supervisorDecision: "test reasoning",
    });
    mockBuildMultiAgentJson.mockReturnValue({ supervisor: { steps: ["review"] }, review: { summary: "test" } });
    mockBuildMultiAgentMarkdown.mockReturnValue("## SupervisorAgent\n\ntest");
  });

  it("returns 200 with successful analysis result", async () => {
    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.parseStatus).toBe("success");
    expect(data.error).toBeNull();
    expect(data.json).toEqual({ supervisor: { steps: ["review"] }, review: { summary: "test" } });
    expect(data.markdown).toBe("## SupervisorAgent\n\ntest");
    expect(data.raw).toBeTruthy();
    expect(data.runLog).not.toBeNull();
    expect(data.runLog.request_status).toBe("success");
    expect(data.runLog.model_name).toBe("test-model");
  });

  it("passes input fields to runAgentPipeline", async () => {
    const payload = makeValidPayload({
      background: "custom bg",
      originalGoal: "custom goal",
      conversation: "custom conv",
      notes: "custom notes",
      expectedOutput: "custom output",
      preferenceRules: ["rule1", "rule2"],
    });

    const req = makeNextRequest(payload);
    await POST(req);

    expect(mockRunAgentPipeline).toHaveBeenCalledOnce();
    const pipelineInput = mockRunAgentPipeline.mock.calls[0][0];
    expect(pipelineInput.background).toBe("custom bg");
    expect(pipelineInput.originalGoal).toBe("custom goal");
    expect(pipelineInput.conversation).toBe("custom conv");
    expect(pipelineInput.notes).toBe("custom notes");
    expect(pipelineInput.expectedOutput).toBe("custom output");
    expect(pipelineInput.preferenceRules).toEqual(["rule1", "rule2"]);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const req = new Request("http://localhost:3000/api/analyze-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    }) as unknown as import("next/server").NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("合法 JSON");
    expect(data.parseStatus).toBe("not_attempted");
    expect(data.runLog).not.toBeNull();
    expect(data.runLog.request_status).toBe("error");
  });

  it("returns 400 when originalGoal is missing", async () => {
    const req = makeNextRequest({
      background: "bg",
      conversation: "conv",
      notes: "",
      expectedOutput: "",
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
      notes: "",
      expectedOutput: "",
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("conversation");
  });

  it("returns 400 when both originalGoal and conversation are empty", async () => {
    const req = makeNextRequest({
      originalGoal: "   ",
      conversation: "   ",
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("originalGoal");
    expect(data.error).toContain("conversation");
  });

  it("handles empty payload gracefully", async () => {
    const req = makeNextRequest({});

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("originalGoal");
  });

  it("defaults missing text fields to empty strings", async () => {
    const req = makeNextRequest({
      originalGoal: "goal",
      conversation: "conv",
    });

    await POST(req);

    const pipelineInput = mockRunAgentPipeline.mock.calls[0][0];
    expect(pipelineInput.background).toBe("");
    expect(pipelineInput.notes).toBe("");
    expect(pipelineInput.expectedOutput).toBe("");
  });

  it("defaults preferenceRules to empty array when not provided", async () => {
    const req = makeNextRequest({
      originalGoal: "goal",
      conversation: "conv",
    });

    await POST(req);

    const pipelineInput = mockRunAgentPipeline.mock.calls[0][0];
    expect(pipelineInput.preferenceRules).toEqual([]);
  });

  it("filters non-string items from preferenceRules", async () => {
    const req = makeNextRequest({
      originalGoal: "goal",
      conversation: "conv",
      preferenceRules: ["valid rule", 42, null, "another rule"],
    });

    await POST(req);

    const pipelineInput = mockRunAgentPipeline.mock.calls[0][0];
    expect(pipelineInput.preferenceRules).toEqual(["valid rule", "another rule"]);
  });

  it("returns 500 when runAgentPipeline throws a generic error", async () => {
    mockRunAgentPipeline.mockRejectedValueOnce(new Error("Pipeline crashed"));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Pipeline crashed");
    expect(data.parseStatus).toBe("not_attempted");
    expect(data.runLog.request_status).toBe("failed");
  });

  it("returns correct status code when ModelCallError is thrown", async () => {
    const { ModelCallError } = await import("../lib/llm");
    mockRunAgentPipeline.mockRejectedValueOnce(new ModelCallError("Rate limited", 429));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Rate limited");
  });

  it("returns 500 when ModelCallError has no status", async () => {
    const { ModelCallError } = await import("../lib/llm");
    mockRunAgentPipeline.mockRejectedValueOnce(new ModelCallError("No status error"));

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);

    expect(response.status).toBe(500);
  });

  it("includes runLog with correct fields in successful response", async () => {
    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(data.runLog.run_id).toBeTruthy();
    expect(data.runLog.run_id.startsWith("run_")).toBe(true);
    expect(data.runLog.created_at).toBeTruthy();
    expect(data.runLog.prompt_version).toContain("multi-agent:");
    expect(data.runLog.duration_ms).toBeGreaterThanOrEqual(0);
    expect(data.runLog.error_message).toBeNull();
  });

  it("includes raw field with steps and supervisorDecision", async () => {
    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(data.raw).toBeTruthy();
    const parsed = JSON.parse(data.raw);
    expect(parsed.steps).toBeDefined();
    expect(parsed.supervisorDecision).toBe("test reasoning");
  });

  it("handles non-object payload", async () => {
    const req = makeNextRequest("just a string");

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("originalGoal");
  });

  it("handles null payload", async () => {
    const req = makeNextRequest(null);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it("preserves missionId when provided", async () => {
    const req = makeNextRequest({
      ...makeValidPayload(),
      missionId: "mission_123",
    });

    await POST(req);

    expect(mockRunAgentPipeline).toHaveBeenCalledOnce();
  });

  it("returns 500 with parseStatus failed when all non-supervisor agents fail", async () => {
    const failedSteps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review", "asset"], reasoning: "test" },
        status: "success",
        error: null,
      },
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: null,
        status: "failed",
        error: "review error",
      },
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:02Z",
        finishedAt: "2026-01-01T00:00:03Z",
        input: {},
        output: null,
        status: "failed",
        error: "asset error",
      },
    ];
    mockRunAgentPipeline.mockResolvedValueOnce({
      steps: failedSteps,
      supervisorDecision: "test",
    });
    mockBuildMultiAgentJson.mockReturnValueOnce({});
    mockBuildMultiAgentMarkdown.mockReturnValueOnce("");

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.parseStatus).toBe("failed");
    expect(data.runLog.request_status).toBe("failed");
    expect(data.runLog.parse_status).toBe("failed");
    expect(data.error).toContain("review");
    expect(data.error).toContain("asset");
  });

  it("returns 200 with parseStatus partial when some non-supervisor agents fail", async () => {
    const partialSteps: AgentStep[] = [
      {
        agent: "supervisor",
        startedAt: "2026-01-01T00:00:00Z",
        finishedAt: "2026-01-01T00:00:01Z",
        input: {},
        output: { steps: ["review", "asset"], reasoning: "test" },
        status: "success",
        error: null,
      },
      {
        agent: "review",
        startedAt: "2026-01-01T00:00:01Z",
        finishedAt: "2026-01-01T00:00:02Z",
        input: {},
        output: { summary: "ok" },
        status: "success",
        error: null,
      },
      {
        agent: "asset",
        startedAt: "2026-01-01T00:00:02Z",
        finishedAt: "2026-01-01T00:00:03Z",
        input: {},
        output: null,
        status: "failed",
        error: "asset error",
      },
    ];
    mockRunAgentPipeline.mockResolvedValueOnce({
      steps: partialSteps,
      supervisorDecision: "test",
    });
    mockBuildMultiAgentJson.mockReturnValueOnce({ review: { summary: "ok" } });
    mockBuildMultiAgentMarkdown.mockReturnValueOnce("## ReviewAgent\n\nok");

    const req = makeNextRequest(makeValidPayload());
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.parseStatus).toBe("partial");
    expect(data.runLog.request_status).toBe("partial");
    expect(data.runLog.parse_status).toBe("partial");
    expect(data.error).toContain("asset");
  });
});
