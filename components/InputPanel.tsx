"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeInput, AnalyzeResponse } from "../lib/analyze-types";
import type { AgentProgressStep } from "./AgentStepProgress";
import type { AgentType } from "../lib/agent-types";
import { getConfirmedRules } from "../lib/preference-rule-store";
import { loadAssets } from "../lib/asset-store";

const initialInput: AnalyzeInput = {
  background: "",
  originalGoal: "",
  conversation: "",
  notes: "",
  expectedOutput: "",
};

const ANALYZE_CLIENT_TIMEOUT_MS = 240_000;

type TextFieldKey = "background" | "originalGoal" | "conversation" | "notes" | "expectedOutput";

type FieldConfig = {
  key: TextFieldKey;
  label: string;
  required?: boolean;
  rows: number;
  placeholder: string;
};

const fields: FieldConfig[] = [
  {
    key: "background",
    label: "Background（背景）",
    rows: 4,
    placeholder: "这段对话发生的背景、项目上下文或学习场景。",
  },
  {
    key: "originalGoal",
    label: "Original Goal（原始目标）",
    required: true,
    rows: 4,
    placeholder: "一开始想解决的问题或判断目标。",
  },
  {
    key: "conversation",
    label: "Conversation（对话内容）",
    required: true,
    rows: 10,
    placeholder: "粘贴完整对话或关键片段。",
  },
  {
    key: "notes",
    label: "Notes（备注）",
    rows: 4,
    placeholder: "补充你认为重要的细节。",
  },
  {
    key: "expectedOutput",
    label: "Expected Output（期望输出）",
    rows: 4,
    placeholder: "可选：希望分析重点关注的方向。",
  },
];

type InputPanelProps = {
  onAnalyzeStart?: () => void;
  onAnalyzeFinish?: (result: AnalyzeResponse) => void;
  onAgentProgress?: (steps: AgentProgressStep[]) => void;
  currentMissionId?: string | null;
  initialInputOverride?: Partial<AnalyzeInput>;
  initialInputSource?: InitialInputSource;
};

export type InitialInputSource = {
  title: string;
  messageCount: number;
  handedOffAt: string;
};

type SSEAgentStartEvent = { agent: AgentType; index: number; total: number };
type SSEAgentCompleteEvent = { agent: AgentType; index: number; total: number; duration_ms: number };
type SSEAgentErrorEvent = { agent: AgentType; index: number; total: number; error: string };
type SSEAgentRetryEvent = { agent: AgentType; index: number; total: number; attempt: number };

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function buildClientErrorResult(error: string): AnalyzeResponse {
  return {
    markdown: null,
    json: null,
    raw: null,
    parseStatus: "not_attempted",
    error,
    runLog: null,
  };
}

async function readSSEStream(
  response: Response,
  onProgress: (steps: AgentProgressStep[]) => void,
  onDone: (result: AnalyzeResponse) => void,
  onError: (error: string) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    onError("无法读取 SSE 流");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  const progressSteps: AgentProgressStep[] = [];

  function handleEvent(eventType: string, dataStr: string) {
    let data: unknown;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }

    if (eventType === "agent_start") {
      const evt = data as SSEAgentStartEvent;
      const existing = progressSteps.find((s) => s.agent === evt.agent);
      if (existing) {
        existing.status = "running";
      } else {
        progressSteps.push({ agent: evt.agent, status: "running" });
      }
      onProgress([...progressSteps]);
    } else if (eventType === "agent_complete") {
      const evt = data as SSEAgentCompleteEvent;
      const existing = progressSteps.find((s) => s.agent === evt.agent);
      if (existing) {
        existing.status = "success";
        existing.durationMs = evt.duration_ms;
      } else {
        progressSteps.push({ agent: evt.agent, status: "success", durationMs: evt.duration_ms });
      }
      onProgress([...progressSteps]);
    } else if (eventType === "agent_error") {
      const evt = data as SSEAgentErrorEvent;
      const existing = progressSteps.find((s) => s.agent === evt.agent);
      if (existing) {
        existing.status = "failed";
        existing.error = evt.error;
      } else {
        progressSteps.push({ agent: evt.agent, status: "failed", error: evt.error });
      }
      onProgress([...progressSteps]);
    } else if (eventType === "agent_retry") {
      const evt = data as SSEAgentRetryEvent;
      const existing = progressSteps.find((s) => s.agent === evt.agent);
      if (existing) {
        existing.status = "running";
      } else {
        progressSteps.push({ agent: evt.agent, status: "running" });
      }
      onProgress([...progressSteps]);
    } else if (eventType === "done") {
      onDone(data as AnalyzeResponse);
    } else if (eventType === "error") {
      const errData = data as { error: string };
      onError(errData.error);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) {
        const remainingLines = buffer.split("\n");
        for (const line of remainingLines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr.trim() && currentEvent) {
              handleEvent(currentEvent, dataStr);
            }
          }
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        handleEvent(currentEvent, dataStr);
      }
    }
  }
}

export function InputPanel({
  onAnalyzeFinish,
  onAnalyzeStart,
  onAgentProgress,
  currentMissionId,
  initialInputOverride,
  initialInputSource,
}: InputPanelProps) {
  const [input, setInput] = useState<AnalyzeInput>({
    ...initialInput,
    ...initialInputOverride,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [readyMessage, setReadyMessage] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"single" | "multi-agent">("single");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!initialInputOverride) return;
    setInput((current) => ({
      ...current,
      ...initialInputOverride,
    }));
    setReadyMessage("");
  }, [initialInputOverride]);

  const originalGoalMissing = useMemo(
    () => input.originalGoal.trim().length === 0,
    [input.originalGoal],
  );
  const conversationMissing = useMemo(
    () => input.conversation.trim().length === 0,
    [input.conversation],
  );

  const canSubmit = !originalGoalMissing && !conversationMissing;

  const requiredStatus = useMemo(
    () =>
      [
        originalGoalMissing ? "Original Goal" : "",
        conversationMissing ? "Conversation" : "",
      ]
        .filter(Boolean)
        .join("、"),
    [conversationMissing, originalGoalMissing],
  );

  function isMissingRequiredField(key: TextFieldKey) {
    return (
      (key === "originalGoal" && originalGoalMissing) ||
      (key === "conversation" && conversationMissing)
    );
  }

  function updateField(key: TextFieldKey, value: string) {
    setInput((current) => ({ ...current, [key]: value }));
    setReadyMessage("");
  }

  function handleCancelAnalyze() {
    if (!abortControllerRef.current) return;
    setReadyMessage("正在取消分析请求。");
    abortControllerRef.current.abort();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (isSubmitting) return;

    if (!canSubmit) {
      setReadyMessage("");
      return;
    }

    const abortController = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      abortController.abort();
    }, ANALYZE_CLIENT_TIMEOUT_MS);

    abortControllerRef.current = abortController;
    setIsSubmitting(true);
    setReadyMessage("正在提交到 Analyze API。");
    onAnalyzeStart?.();

    const allAssets = loadAssets();
    const existingAssets = allAssets
      .filter((a) => a.status === "confirmed")
      .map((a) => ({ asset_id: a.asset_id, title: a.title, asset_type: a.asset_type }));

    const requestBody = JSON.stringify({
      ...input,
      preferenceRules: getConfirmedRules().map((r) => r.content),
      missionId: currentMissionId,
      existingAssets: existingAssets.length > 0 ? existingAssets : undefined,
    });

    if (analysisMode === "multi-agent") {
      try {
        const response = await fetch("/api/analyze-agents?stream=1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: requestBody,
          signal: abortController.signal,
        });

        if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const result = (await response.json()) as AnalyzeResponse;
          setReadyMessage(result.error ?? "分析失败。");
          onAnalyzeFinish?.(result);
          return;
        }

        if (!response.ok) {
          setReadyMessage("分析请求失败，请稍后重试。");
          setIsSubmitting(false);
          return;
        }

        await readSSEStream(
          response,
          (steps) => {
            onAgentProgress?.(steps);
          },
          (result) => {
            setReadyMessage(
              result.error ??
                (result.raw ? "模型调用完成，已收到模型原始输出。" : "Analyze API 已接收输入。"),
            );
            onAnalyzeFinish?.(result);
          },
          (error) => {
            setReadyMessage(error);
            onAnalyzeFinish?.({
              markdown: null,
              json: null,
              raw: null,
              parseStatus: "not_attempted",
              error,
              runLog: null,
            });
          },
        );
      } catch (error) {
        const message = isAbortError(error)
          ? didTimeout
            ? "分析请求超过 240 秒，已自动取消。"
            : "分析已取消。"
          : "提交失败，请稍后重试。";
        setReadyMessage(message);
        onAnalyzeFinish?.(buildClientErrorResult(message));
      } finally {
        window.clearTimeout(timeoutId);
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const apiEndpoint = "/api/analyze";
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: abortController.signal,
      });
      const result = (await response.json()) as AnalyzeResponse;

      setReadyMessage(
        result.error ??
          (result.raw ? "模型调用完成，已收到模型原始输出。" : "Analyze API 已接收输入。"),
      );
      onAnalyzeFinish?.(result);
    } catch (error) {
      const message = isAbortError(error)
        ? didTimeout
          ? "分析请求超过 240 秒，已自动取消。"
          : "分析已取消。"
        : "提交失败，请稍后重试。";
      setReadyMessage(message);
      onAnalyzeFinish?.(buildClientErrorResult(message));
    } finally {
      window.clearTimeout(timeoutId);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex h-full min-w-0 flex-col gap-3" onSubmit={handleSubmit}>
      {initialInputSource ? (
        <div className="rounded-lg border border-blue/20 bg-blue/5 px-3 py-2" role="status">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Review Handoff</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            已从对话带入：{initialInputSource.title || "未命名对话"} · {initialInputSource.messageCount} turns · {new Date(initialInputSource.handedOffAt).toLocaleString()}
          </p>
        </div>
      ) : null}
      <div className="grid min-w-0 gap-3">
        {fields.map((field) => {
          const showRequiredHint =
            field.required && isMissingRequiredField(field.key);
          const showError = submitted && showRequiredHint;

          return (
            <label
              className={
                field.key === "conversation"
                  ? "flex min-w-0 flex-col gap-1.5"
                  : "flex min-w-0 flex-col gap-1.5"
              }
              key={field.key}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {field.label}
                {field.required ? (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber" />
                ) : null}
              </span>
              <textarea
                className="min-h-0 resize-y rounded-lg border-0 bg-surface-2/80 px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:ring-2 focus:ring-blue/30"
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows}
                value={input[field.key]}
              />
              {showError ? (
                <span className="mt-1 text-xs text-amber">此项不能为空。</span>
              ) : showRequiredHint ? (
                <span className="mt-1 text-xs text-ink-muted/70">填写后可提交。</span>
              ) : null}
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-5 text-xs text-ink-muted">
          {readyMessage ||
            (!canSubmit ? `请补全必填输入：${requiredStatus}。` : "")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5">
            <button
              className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                analysisMode === "single"
                  ? "bg-surface-2 text-white"
                  : "text-ink-muted hover:text-ink"
              }`}
              onClick={() => setAnalysisMode("single")}
              type="button"
            >
              单 Prompt
            </button>
            <button
              className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                analysisMode === "multi-agent"
                  ? "bg-blue text-white"
                  : "text-ink-muted hover:text-ink"
              }`}
              onClick={() => setAnalysisMode("multi-agent")}
              type="button"
            >
              多 Agent
            </button>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg bg-blue px-5 text-sm font-semibold text-white transition hover:bg-blue/80 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-muted/50"
            disabled={!canSubmit || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Submitting" : "Analyze"}
          </button>
          {isSubmitting ? (
            <button
              className="inline-flex h-9 items-center justify-center rounded-lg border border-amber/30 px-4 text-sm font-semibold text-amber transition hover:bg-amber/10"
              onClick={handleCancelAnalyze}
              type="button"
            >
              取消
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
