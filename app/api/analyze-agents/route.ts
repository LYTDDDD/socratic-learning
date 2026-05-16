import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeInput, AnalyzeResponse } from "../../../lib/analyze-types";
import { getModelConfig, ModelCallError } from "../../../lib/llm";
import { generateRunId } from "../../../lib/run-log";
import type { RunLog } from "../../../lib/run-log";
import { OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION } from "../../../lib/prompt";
import { runAgentPipeline, buildMultiAgentJson, buildMultiAgentMarkdown } from "../../../lib/agent-pipeline";
import type { AgentType, RetryOptions } from "../../../lib/agent-types";

const DEFAULT_RETRY_OPTIONS: RetryOptions = { maxRetries: 1, retryDelayMs: 1000 };

function getModelName(): string {
  try {
    return getModelConfig().model;
  } catch {
    return "unknown";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTextField(input: Record<string, unknown>, key: keyof AnalyzeInput) {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

function parseAnalyzeInput(payload: unknown): AnalyzeInput {
  const input = isRecord(payload) ? payload : {};
  return {
    background: readTextField(input, "background"),
    originalGoal: readTextField(input, "originalGoal"),
    conversation: readTextField(input, "conversation"),
    notes: readTextField(input, "notes"),
    expectedOutput: readTextField(input, "expectedOutput"),
    preferenceRules: Array.isArray(input.preferenceRules)
      ? input.preferenceRules.filter((v): v is string => typeof v === "string")
      : [],
    missionId: typeof input.missionId === "string" ? input.missionId : null,
  };
}

function wantsSSE(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) return true;
  const url = new URL(request.url);
  return url.searchParams.get("stream") === "1";
}

function encodeSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildFinalResult(
  steps: Parameters<typeof buildMultiAgentJson>[0],
  supervisorDecision: string,
  run_id: string,
  startedAt: number,
  model_name: string,
  input: { originalGoal: string; conversation: string },
): { response: AnalyzeResponse; httpStatus: number } {
  const markdown = buildMultiAgentMarkdown(steps);
  const json = buildMultiAgentJson(steps);

  const nonSupervisorSteps = steps.filter((s: { agent: string }) => s.agent !== "supervisor");
  const failedSteps = nonSupervisorSteps.filter((s: { status: string }) => s.status === "failed");
  const successSteps = nonSupervisorSteps.filter((s: { status: string }) => s.status === "success");

  let request_status: "success" | "partial" | "failed";
  let parseStatus: "success" | "partial" | "failed";
  let error: string | null;
  let httpStatus: number;

  if (successSteps.length === 0) {
    request_status = "failed";
    parseStatus = "failed";
    error = failedSteps.map((s: { agent: string; error: string | null }) => `${s.agent}: ${s.error}`).join("; ") || "所有 Agent 执行失败";
    httpStatus = 500;
  } else if (failedSteps.length > 0) {
    request_status = "partial";
    parseStatus = "partial";
    error = `部分 Agent 执行失败：${failedSteps.map((s: { agent: string }) => s.agent).join(", ")}`;
    httpStatus = 200;
  } else {
    request_status = "success";
    parseStatus = "success";
    error = null;
    httpStatus = 200;
  }

  const runLog: RunLog = {
    run_id,
    created_at: new Date(startedAt).toISOString(),
    input_snapshot: { originalGoal: input.originalGoal, conversation: input.conversation },
    prompt_version: `multi-agent:${OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION}`,
    model_name,
    request_status,
    parse_status: parseStatus,
    duration_ms: Date.now() - startedAt,
    error_message: error,
  };

  const response: AnalyzeResponse = {
    markdown,
    json,
    raw: JSON.stringify({ steps, supervisorDecision }, null, 2),
    parseStatus,
    error,
    runLog,
  };

  return { response, httpStatus };
}

function handleSSEStream(
  input: AnalyzeInput,
  run_id: string,
  startedAt: number,
  model_name: string,
  request: NextRequest,
): Response {
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(encodeSSE(event, data)));
      }

      request.signal.addEventListener("abort", () => {
        abortController.abort();
        try { controller.close(); } catch {}
      });

      try {
        const { steps, supervisorDecision } = await runAgentPipeline(
          {
            background: input.background,
            originalGoal: input.originalGoal,
            conversation: input.conversation,
            notes: input.notes,
            expectedOutput: input.expectedOutput,
            preferenceRules: input.preferenceRules ?? [],
          },
          {
            onStepStart: (agent: AgentType, index: number, total: number) => {
              send("agent_start", { agent, index, total });
            },
            onStepComplete: (agent: AgentType, index: number, total: number, durationMs: number) => {
              send("agent_complete", { agent, index, total, duration_ms: durationMs });
            },
            onStepError: (agent: AgentType, index: number, total: number, error: string) => {
              send("agent_error", { agent, index, total, error });
            },
            onStepRetry: (agent: AgentType, index: number, total: number, attempt: number) => {
              send("agent_retry", { agent, index, total, attempt });
            },
          },
          DEFAULT_RETRY_OPTIONS,
          request.signal,
        );

        const { response } = buildFinalResult(
          steps,
          supervisorDecision,
          run_id,
          startedAt,
          model_name,
          { originalGoal: input.originalGoal, conversation: input.conversation },
        );

        send("done", response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "多 Agent 分析失败";
        send("error", { error: errorMessage });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  const run_id = generateRunId();
  const startedAt = Date.now();
  const model_name = getModelName();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const runLog: RunLog = {
      run_id,
      created_at: new Date(startedAt).toISOString(),
      input_snapshot: { originalGoal: "", conversation: "" },
      prompt_version: OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION,
      model_name,
      request_status: "error",
      parse_status: "not_attempted",
      duration_ms: Date.now() - startedAt,
      error_message: "请求体必须是合法 JSON。",
    };
    return NextResponse.json<AnalyzeResponse>(
      {
        markdown: null,
        json: null,
        raw: null,
        parseStatus: "not_attempted",
        error: "请求体必须是合法 JSON。",
        runLog,
      },
      { status: 400 },
    );
  }

  const input = parseAnalyzeInput(payload);
  const missingFields = [
    input.originalGoal.trim().length === 0 ? "originalGoal" : "",
    input.conversation.trim().length === 0 ? "conversation" : "",
  ].filter(Boolean);

  if (missingFields.length > 0) {
    const runLog: RunLog = {
      run_id,
      created_at: new Date(startedAt).toISOString(),
      input_snapshot: { originalGoal: input.originalGoal, conversation: input.conversation },
      prompt_version: OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION,
      model_name,
      request_status: "error",
      parse_status: "not_attempted",
      duration_ms: Date.now() - startedAt,
      error_message: `缺少必填输入：${missingFields.join(", ")}。`,
    };
    return NextResponse.json<AnalyzeResponse>(
      {
        markdown: null,
        json: null,
        raw: null,
        parseStatus: "not_attempted",
        error: `缺少必填输入：${missingFields.join(", ")}。`,
        runLog,
      },
      { status: 400 },
    );
  }

  if (wantsSSE(request)) {
    return handleSSEStream(input, run_id, startedAt, model_name, request);
  }

  try {
    const { steps, supervisorDecision } = await runAgentPipeline({
      background: input.background,
      originalGoal: input.originalGoal,
      conversation: input.conversation,
      notes: input.notes,
      expectedOutput: input.expectedOutput,
      preferenceRules: input.preferenceRules ?? [],
    }, undefined, DEFAULT_RETRY_OPTIONS, request.signal);

    const { response, httpStatus } = buildFinalResult(
      steps,
      supervisorDecision,
      run_id,
      startedAt,
      model_name,
      { originalGoal: input.originalGoal, conversation: input.conversation },
    );

    return NextResponse.json<AnalyzeResponse>(response, { status: httpStatus });
  } catch (error) {
    const status =
      error instanceof ModelCallError && error.status ? error.status : 500;
    const errorMessage = error instanceof Error ? error.message : "多 Agent 分析失败";

    const runLog: RunLog = {
      run_id,
      created_at: new Date(startedAt).toISOString(),
      input_snapshot: { originalGoal: input.originalGoal, conversation: input.conversation },
      prompt_version: `multi-agent:${OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION}`,
      model_name,
      request_status: "failed",
      parse_status: "not_attempted",
      duration_ms: Date.now() - startedAt,
      error_message: errorMessage,
    };

    return NextResponse.json<AnalyzeResponse>(
      {
        markdown: null,
        json: null,
        raw: null,
        parseStatus: "not_attempted",
        error: errorMessage,
        runLog,
      },
      { status },
    );
  }
}
