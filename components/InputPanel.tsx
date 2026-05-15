"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AnalyzeInput, AnalyzeResponse } from "../lib/analyze-types";
import type { AgentProgressStep } from "./AgentStepProgress";
import type { AgentType } from "../lib/agent-types";
import { getConfirmedRules } from "../lib/preference-rule-store";

const initialInput: AnalyzeInput = {
  background: "",
  originalGoal: "",
  conversation: "",
  notes: "",
  expectedOutput: "",
};

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
};

type SSEAgentStartEvent = { agent: AgentType; index: number; total: number };
type SSEAgentCompleteEvent = { agent: AgentType; index: number; total: number; duration_ms: number };
type SSEAgentErrorEvent = { agent: AgentType; index: number; total: number; error: string };
type SSEAgentRetryEvent = { agent: AgentType; index: number; total: number; attempt: number };

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
}: InputPanelProps) {
  const [input, setInput] = useState<AnalyzeInput>({
    ...initialInput,
    ...initialInputOverride,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [readyMessage, setReadyMessage] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"single" | "multi-agent">("single");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!canSubmit) {
      setReadyMessage("");
      return;
    }

    setIsSubmitting(true);
    setReadyMessage("正在提交到 Analyze API。");
    onAnalyzeStart?.();

    const requestBody = JSON.stringify({
      ...input,
      preferenceRules: getConfirmedRules().map((r) => r.content),
      missionId: currentMissionId,
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
                (result.raw ? "模型调用完成，已收到 raw output。" : "Analyze API 已接收输入。"),
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
      } catch {
        setReadyMessage("提交失败，请稍后重试。");
        onAnalyzeFinish?.({
          markdown: null,
          json: null,
          raw: null,
          parseStatus: "not_attempted",
          error: "提交失败，请稍后重试。",
          runLog: null,
        });
      } finally {
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
      });
      const result = (await response.json()) as AnalyzeResponse;

      setReadyMessage(
        result.error ??
          (result.raw ? "模型调用完成，已收到 raw output。" : "Analyze API 已接收输入。"),
      );
      onAnalyzeFinish?.(result);
    } catch {
      setReadyMessage("提交失败，请稍后重试。");
      onAnalyzeFinish?.({
        markdown: null,
        json: null,
        raw: null,
        parseStatus: "not_attempted",
        error: "提交失败，请稍后重试。",
        runLog: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex h-full flex-col gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {fields.map((field) => {
          const showRequiredHint =
            field.required && isMissingRequiredField(field.key);
          const showError = submitted && showRequiredHint;

          return (
            <label
              className={
                field.key === "conversation"
                  ? "flex flex-col gap-2 lg:row-span-2"
                  : "flex flex-col gap-2"
              }
              key={field.key}
            >
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
                {field.label}
                {field.required ? (
                  <span className="text-xs font-medium text-rust">必填</span>
                ) : null}
              </span>
              <textarea
                className="min-h-0 resize-y rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/20"
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows}
                value={input[field.key]}
              />
              {showError ? (
                <span className="text-sm text-rust">此项不能为空。</span>
              ) : showRequiredHint ? (
                <span className="text-sm text-ink/50">填写后可提交。</span>
              ) : null}
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-6 text-sm text-ink/70">
          {readyMessage ||
            (!canSubmit ? `请补全必填输入：${requiredStatus}。` : "")}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            <button
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                analysisMode === "single"
                  ? "bg-ink text-white"
                  : "text-ink/50 hover:text-ink"
              }`}
              onClick={() => setAnalysisMode("single")}
              type="button"
            >
              单 Prompt
            </button>
            <button
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                analysisMode === "multi-agent"
                  ? "bg-moss text-white"
                  : "text-ink/50 hover:text-ink"
              }`}
              onClick={() => setAnalysisMode("multi-agent")}
              type="button"
            >
              多 Agent
            </button>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink/45"
            disabled={!canSubmit || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Submitting" : "Analyze"}
          </button>
        </div>
      </div>
    </form>
  );
}
