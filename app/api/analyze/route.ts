import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeInput, AnalyzeResponse } from "../../../lib/analyze-types";
import { callAnalysisModel, getModelConfig, ModelCallError } from "../../../lib/llm";
import { extractJsonFromOutput } from "../../../lib/extract-json";
import { buildMarkdownFromAnalysisJson } from "../../../lib/analysis-markdown";
import {
  OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION,
  readOfflineMissionAnalysisPrompt,
} from "../../../lib/prompt";
import type { RunLog } from "../../../lib/run-log";
import { generateRunId } from "../../../lib/run-log";

function buildResponse(
  body: AnalyzeResponse,
  init?: ResponseInit,
): NextResponse<AnalyzeResponse> {
  return NextResponse.json(body, init);
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

function getModelName(): string {
  try {
    return getModelConfig().model;
  } catch {
    return "unknown";
  }
}

function getParseRetryLimit(): number {
  const parsed = Number.parseInt(process.env.ANALYZE_PARSE_RETRIES ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(parsed, 2));
}

function buildJsonOnlyRetryPrompt(prompt: string): string {
  return [
    "【最高优先级指令】只输出合法 JSON 对象。",
    "不要输出 Markdown、代码块、```json 包裹、解释文字或 JSON 之外的任何字符。",
    "JSON 顶层必须包含 mission_review、depth_evaluation、asset_decision、trace_summary。",
    "如需人类可读内容，也必须写入 JSON 字段，前端会从 JSON 渲染页面和导出 Markdown。",
    "",
    "---",
    "",
    prompt,
  ].join("\n");
}

function deriveMarkdown(json: unknown, markdown?: string): string | null {
  const trimmed = typeof markdown === "string" ? markdown.trim() : "";
  if (trimmed) return trimmed;
  return buildMarkdownFromAnalysisJson(json);
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
    return buildResponse(
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
    return buildResponse(
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
    const prompt = await readOfflineMissionAnalysisPrompt();
    let raw = await callAnalysisModel(prompt, input, request.signal);
    let extracted = extractJsonFromOutput(raw);

    if (!extracted.success && getParseRetryLimit() > 0) {
      console.warn("JSON extraction failed on first attempt, retrying with configured limit.", {
        run_id,
        rawLength: raw.length,
      });

      const retryPrompt = buildJsonOnlyRetryPrompt(prompt);

      try {
        const retryRaw = await callAnalysisModel(retryPrompt, input, request.signal);
        const retryExtracted = extractJsonFromOutput(retryRaw);
        if (retryExtracted.success) {
          raw = retryRaw;
          extracted = retryExtracted;
        } else if (getParseRetryLimit() > 1) {
          console.warn("Retry 1 also failed, attempting retry 2 with JSON-only request...");

          try {
            const retry2Raw = await callAnalysisModel(buildJsonOnlyRetryPrompt(prompt), input, request.signal);
            const retry2Extracted = extractJsonFromOutput(retry2Raw);
            if (retry2Extracted.success) {
              raw = retry2Raw;
              extracted = {
                success: true,
                json: retry2Extracted.json,
                markdown: retry2Extracted.markdown ?? extracted.markdown,
              };
            }
          } catch (retry2Error) {
            console.error("Retry 2 also failed:", retry2Error instanceof Error ? retry2Error.message : retry2Error);
          }
        }
      } catch (retryError) {
        console.error("Retry 1 failed:", retryError instanceof Error ? retryError.message : retryError);
      }
    }

    if (extracted.success) {
      const runLog: RunLog = {
        run_id,
        created_at: new Date(startedAt).toISOString(),
        input_snapshot: { originalGoal: input.originalGoal, conversation: input.conversation },
        prompt_version: OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION,
        model_name,
        request_status: "success",
        parse_status: "success",
        duration_ms: Date.now() - startedAt,
        error_message: null,
      };
      const markdown = deriveMarkdown(extracted.json, extracted.markdown);
      return buildResponse({
        markdown,
        json: extracted.json ?? null,
        raw,
        parseStatus: "success",
        error: null,
        runLog,
      });
    }

    console.error("JSON extraction failed", {
      run_id,
      error: extracted.error,
      rawLength: raw.length,
    });

    const runLog: RunLog = {
      run_id,
      created_at: new Date(startedAt).toISOString(),
      input_snapshot: { originalGoal: input.originalGoal, conversation: input.conversation },
      prompt_version: OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION,
      model_name,
      request_status: "success",
      parse_status: "failed",
      duration_ms: Date.now() - startedAt,
      error_message: extracted.error ?? null,
    };
    return buildResponse({
      markdown: extracted.markdown ?? null,
      json: null,
      raw,
      parseStatus: "failed",
      error: extracted.error ?? null,
      runLog,
    });
  } catch (error) {
    console.error("Analyze model call failed", error);
    const status =
      error instanceof ModelCallError && error.status ? error.status : 500;

    const errorMessage = error instanceof Error ? error.message : "模型调用失败";
    const runLog: RunLog = {
      run_id,
      created_at: new Date(startedAt).toISOString(),
      input_snapshot: { originalGoal: input.originalGoal, conversation: input.conversation },
      prompt_version: OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION,
      model_name,
      request_status: "failed",
      parse_status: "not_attempted",
      duration_ms: Date.now() - startedAt,
      error_message: errorMessage,
    };
    return buildResponse(
      {
        markdown: null,
        json: null,
        raw: null,
        parseStatus: "not_attempted",
        error: `模型调用失败，请检查模型配置或稍后重试。（Prompt：${OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION}）`,
        runLog,
      },
      { status },
    );
  }
}
