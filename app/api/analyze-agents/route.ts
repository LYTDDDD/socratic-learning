import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeInput, AnalyzeResponse } from "../../../lib/analyze-types";
import { getModelConfig, ModelCallError } from "../../../lib/llm";
import { generateRunId } from "../../../lib/run-log";
import type { RunLog } from "../../../lib/run-log";
import { OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION } from "../../../lib/prompt";
import { runAgentPipeline, buildMultiAgentJson, buildMultiAgentMarkdown } from "../../../lib/agent-pipeline";

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

  try {
    const { steps, supervisorDecision } = await runAgentPipeline({
      background: input.background,
      originalGoal: input.originalGoal,
      conversation: input.conversation,
      notes: input.notes,
      expectedOutput: input.expectedOutput,
      preferenceRules: input.preferenceRules ?? [],
    });

    const markdown = buildMultiAgentMarkdown(steps);
    const json = buildMultiAgentJson(steps);

    const nonSupervisorSteps = steps.filter((s) => s.agent !== "supervisor");
    const failedSteps = nonSupervisorSteps.filter((s) => s.status === "failed");
    const successSteps = nonSupervisorSteps.filter((s) => s.status === "success");

    let request_status: "success" | "partial" | "failed";
    let parseStatus: "success" | "partial" | "failed";
    let error: string | null;
    let httpStatus: number;

    if (successSteps.length === 0) {
      request_status = "failed";
      parseStatus = "failed";
      error = failedSteps.map((s) => `${s.agent}: ${s.error}`).join("; ") || "所有 Agent 执行失败";
      httpStatus = 500;
    } else if (failedSteps.length > 0) {
      request_status = "partial";
      parseStatus = "partial";
      error = `部分 Agent 执行失败：${failedSteps.map((s) => s.agent).join(", ")}`;
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

    return NextResponse.json<AnalyzeResponse>(
      {
        markdown,
        json,
        raw: JSON.stringify({ steps, supervisorDecision }, null, 2),
        parseStatus,
        error,
        runLog,
      },
      { status: httpStatus },
    );
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
