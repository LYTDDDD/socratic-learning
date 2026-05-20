"use client";

import { useState, type ReactNode } from "react";
import type { RunLog, RunLogUserAction, RunLogUserActionType } from "../lib/run-log";

function statusBadge(status: string) {
  if (status === "success") return "bg-blue/15 text-blue";
  if (status === "failed") return "bg-amber/15 text-amber";
  if (status === "partial") return "bg-amber/10 text-amber";
  return "bg-surface-2 text-ink-muted";
}

function rawActionLabel(verb: "复制" | "下载", rawLabel: string): string {
  return rawLabel.startsWith("Agent") ? `${verb} ${rawLabel}` : `${verb}${rawLabel}`;
}

function userActionLabel(action: RunLogUserAction, rawLabel: string): string {
  const labels: Record<RunLogUserActionType, string> = {
    copy_report: "复制报告",
    copy_markdown: "复制 Markdown",
    copy_json: "复制 JSON",
    copy_raw: rawActionLabel("复制", rawLabel),
    download_markdown: "下载 Markdown",
    download_json: "下载 JSON",
    download_raw: rawActionLabel("下载", rawLabel),
    mark_reviewed: "标记已审阅",
    mark_discarded: "标记废弃",
    restore_report: "恢复报告",
    confirm_asset: "确认资产",
    discard_asset: "丢弃资产候选",
  };
  return labels[action.type];
}

function formatActionTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mi}:${ss}`;
  } catch {
    return iso;
  }
}

export function RunLogPanel({ runLog }: { runLog: RunLog }) {
  const hasError = Boolean(runLog.error_message);
  const [expanded, setExpanded] = useState(hasError);
  const inputChars = runLog.input_snapshot.originalGoal.length + runLog.input_snapshot.conversation.length;
  const userActions = runLog.user_actions ?? [];
  const latestActions = userActions.slice(-5).reverse();
  const rawLabel = runLog.prompt_version.startsWith("multi-agent:") ? "Agent 执行轨迹" : "模型原始输出";
  const rows: { label: string; value: ReactNode }[] = [
    { label: "Run ID", value: <code className="font-mono text-xs">{runLog.run_id}</code> },
    { label: "Created At", value: runLog.created_at },
    { label: "Prompt Version", value: runLog.prompt_version },
    { label: "Model", value: runLog.model_name },
    {
      label: "Request Status",
      value: (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(runLog.request_status)}`}>
          {runLog.request_status}
        </span>
      ),
    },
    {
      label: "Parse Status",
      value: (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(runLog.parse_status)}`}>
          {runLog.parse_status}
        </span>
      ),
    },
    { label: "Duration", value: `${runLog.duration_ms} ms` },
    { label: "Original Goal", value: runLog.input_snapshot.originalGoal ? `${runLog.input_snapshot.originalGoal.slice(0, 120)}${runLog.input_snapshot.originalGoal.length > 120 ? "..." : ""}` : "(empty)" },
    { label: "Conversation", value: runLog.input_snapshot.conversation ? `${runLog.input_snapshot.conversation.slice(0, 80)}${runLog.input_snapshot.conversation.length > 80 ? "..." : ""}` : "(empty)" },
  ];

  if (runLog.error_message) {
    const truncated = runLog.error_message.length > 200 ? `${runLog.error_message.slice(0, 200)}...` : runLog.error_message;
    rows.push({ label: "Error", value: <span className="text-amber">{truncated}</span> });
  }

  return (
    <div className={`rounded-lg p-3 ${hasError ? "border border-amber/30 bg-amber/5" : "bg-surface-2/50"}`}>
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue">Evidence Trail</span>
          <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">Run Log</span>
          <span className="mt-1 block text-xs text-ink-muted">
            {runLog.request_status} · {runLog.parse_status} · {runLog.duration_ms} ms
          </span>
        </span>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(runLog.request_status)}`}>
          {expanded ? "收起" : "展开"}
        </span>
      </button>
      {expanded && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{runLog.duration_ms}</p>
              <p className="text-[10px] text-ink-muted">ms</p>
            </div>
            <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{inputChars}</p>
              <p className="text-[10px] text-ink-muted">input chars</p>
            </div>
            <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{hasError ? 1 : 0}</p>
              <p className="text-[10px] text-ink-muted">errors</p>
            </div>
            <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{userActions.length}</p>
              <p className="text-[10px] text-ink-muted">actions</p>
            </div>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {rows.map((row) => (
              <span key={row.label} className="contents">
                <dt className="whitespace-nowrap font-medium text-ink-muted">{row.label}</dt>
                <dd className="break-all text-ink">{row.value}</dd>
              </span>
            ))}
          </dl>
          {latestActions.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">User Actions</p>
              <ul className="mt-2 space-y-1">
                {latestActions.map((action) => (
                  <li className="flex items-center justify-between gap-3 text-xs" key={`${action.type}-${action.at}`}>
                    <span className="text-ink">{userActionLabel(action, rawLabel)}</span>
                    <time className="shrink-0 font-mono text-[10px] text-ink-muted">{formatActionTime(action.at)}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
