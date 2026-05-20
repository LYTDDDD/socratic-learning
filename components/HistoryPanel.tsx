"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoryEntry, HistoryStatus } from "../lib/history-store";
import { appendRunLogUserAction, loadHistory, deleteFromHistory, clearHistory, updateHistoryStatus } from "../lib/history-store";
import type { AnalyzeResponse } from "../lib/analyze-types";
import { buildMarkdownFromAnalysisJson } from "../lib/analysis-markdown";
import type { RunLogUserAction } from "../lib/run-log";

type HistoryPanelProps = {
  onSelect: (response: AnalyzeResponse, runId: string, status: HistoryStatus) => void;
  onClear?: () => void;
  onDelete?: (runId: string) => void;
  onStatusChange?: (runId: string, newStatus: HistoryStatus) => void;
  onUserActionRecorded?: (runId: string, action: RunLogUserAction) => void;
  refreshKey: number;
};

function reqStatusBadge(status: string) {
  if (status === "success") return "bg-green-100 text-green-800";
  if (status === "failed") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function historyStatusBadge(status: HistoryStatus) {
  if (status === "draft") return "bg-yellow-100 text-yellow-800";
  if (status === "reviewed") return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-500";
}

function historyStatusLabel(status: HistoryStatus) {
  if (status === "draft") return "草稿";
  if (status === "reviewed") return "已审阅";
  return "已废弃";
}

function countByStatus(entries: HistoryEntry[], status: HistoryStatus): number {
  return entries.filter((entry) => entry.status === status).length;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

export function HistoryPanel({ onSelect, onClear, onDelete, onStatusChange, onUserActionRecorded, refreshKey }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [copiedMdId, setCopiedMdId] = useState<string | null>(null);
  const [copiedJsonId, setCopiedJsonId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEntries(loadHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refreshKey, refresh]);

  function handleDelete(runId: string) {
    if (!window.confirm("确认删除这条历史记录？此操作无法撤销。")) return;
    deleteFromHistory(runId);
    onDelete?.(runId);
    refresh();
  }

  function handleClear() {
    if (!window.confirm("确认清空全部历史记录？此操作无法撤销。")) return;
    clearHistory();
    setEntries([]);
    onClear?.();
  }

  function handleSelect(entry: HistoryEntry) {
    let status = entry.status;
    if (entry.status === "draft") {
      updateHistoryStatus(entry.run_id, "reviewed");
      status = "reviewed";
    }
    onSelect(entry.analyzeResponse, entry.run_id, status);
    refresh();
  }

  function handleDiscard(runId: string) {
    updateHistoryStatus(runId, "discarded");
    onStatusChange?.(runId, "discarded");
    refresh();
  }

  function handleRestore(runId: string) {
    updateHistoryStatus(runId, "draft");
    onStatusChange?.(runId, "draft");
    refresh();
  }

  async function handleCopyMd(entry: HistoryEntry) {
    const text = entry.analyzeResponse.markdown ?? buildMarkdownFromAnalysisJson(entry.analyzeResponse.json) ?? "";
    try {
      await navigator.clipboard.writeText(text);
      const action = appendRunLogUserAction(entry.run_id, "copy_markdown");
      if (action) onUserActionRecorded?.(entry.run_id, action);
      setCopiedMdId(entry.run_id);
      setTimeout(() => setCopiedMdId((prev) => (prev === entry.run_id ? null : prev)), 1500);
    } catch {}
  }

  async function handleCopyJson(entry: HistoryEntry) {
    const text = JSON.stringify(entry.analyzeResponse, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      const action = appendRunLogUserAction(entry.run_id, "copy_json");
      if (action) onUserActionRecorded?.(entry.run_id, action);
      setCopiedJsonId(entry.run_id);
      setTimeout(() => setCopiedJsonId((prev) => (prev === entry.run_id ? null : prev)), 1500);
    } catch {}
  }

  const visibleEntries = showDiscarded
    ? entries
    : entries.filter((e) => e.status !== "discarded");

  const discardedCount = entries.filter((e) => e.status === "discarded").length;
  const draftCount = countByStatus(entries, "draft");
  const reviewedCount = countByStatus(entries, "reviewed");

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-paper/60 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Report History</p>
        <h3 className="mt-1 text-sm font-semibold text-ink">历史记录</h3>
        <p className="mt-2 text-sm text-ink/50">暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Report History</p>
          <h3 className="mt-1 text-sm font-semibold text-ink">历史记录</h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">回看分析报告，审阅后会进入 Mission 和资产链路。</p>
        </div>
        <div className="flex items-center gap-2">
          {discardedCount > 0 && (
            <button
              className={`rounded px-2 py-1 text-xs font-medium transition ${showDiscarded ? "bg-gray-200 text-gray-700" : "text-ink/50 hover:text-ink/70"}`}
              onClick={() => setShowDiscarded((v) => !v)}
              type="button"
            >
              {showDiscarded ? "隐藏已废弃" : `显示已废弃 (${discardedCount})`}
            </button>
          )}
          <button
            className="rounded px-2 py-1 text-xs font-medium text-amber transition hover:bg-red-50"
            onClick={handleClear}
            type="button"
          >
            清空历史
          </button>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5 text-center">
          <p className="text-sm font-semibold text-ink">{entries.length}</p>
          <p className="text-[10px] text-ink-muted">reports</p>
        </div>
        <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5 text-center">
          <p className="text-sm font-semibold text-ink">{draftCount}</p>
          <p className="text-[10px] text-ink-muted">to review</p>
        </div>
        <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5 text-center">
          <p className="text-sm font-semibold text-ink">{reviewedCount}</p>
          <p className="text-[10px] text-ink-muted">reviewed</p>
        </div>
      </div>
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {visibleEntries.map((entry) => {
          const reqStatus = entry.analyzeResponse.runLog?.request_status ?? "error";
          const isDiscarded = entry.status === "discarded";
          return (
            <li
              className={`group flex items-start gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 transition hover:border-blue/40 hover:shadow-sm ${isDiscarded ? "opacity-50" : ""}`}
              key={entry.run_id}
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => handleSelect(entry)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <code className="truncate text-xs text-ink/70">
                    {entry.run_id.length > 18 ? `${entry.run_id.slice(0, 18)}...` : entry.run_id}
                  </code>
                  <span
                    className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${reqStatusBadge(reqStatus)}`}
                  >
                    {reqStatus}
                  </span>
                  <span
                    className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${historyStatusBadge(entry.status)}`}
                  >
                    {historyStatusLabel(entry.status)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {formatTime(entry.created_at)}
                  {entry.input_snapshot.originalGoal
                    ? ` · ${entry.input_snapshot.originalGoal.slice(0, 30)}${entry.input_snapshot.originalGoal.length > 30 ? "..." : ""}`
                    : ""}
                </div>
              </button>
              <div className="flex shrink-0 items-start gap-0.5">
                <button
                  className={`rounded p-1 text-[10px] font-bold transition ${copiedMdId === entry.run_id ? "text-green-500" : "text-ink-muted/50 hover:bg-blue-50 hover:text-blue-500"}`}
                  onClick={() => handleCopyMd(entry)}
                  title="复制 Markdown"
                  type="button"
                >
                  {copiedMdId === entry.run_id ? (
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    "M"
                  )}
                </button>
                <button
                  className={`rounded p-1 text-[10px] font-bold transition ${copiedJsonId === entry.run_id ? "text-green-500" : "text-ink/30 hover:bg-blue-50 hover:text-blue-500"}`}
                  onClick={() => handleCopyJson(entry)}
                  title="复制 JSON"
                  type="button"
                >
                  {copiedJsonId === entry.run_id ? (
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    "J"
                  )}
                </button>
                {isDiscarded ? (
                  <button
                    className="rounded p-1 text-ink/30 transition hover:bg-green-50 hover:text-green-600"
                    onClick={() => handleRestore(entry.run_id)}
                    title="恢复"
                    type="button"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M1 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  <button
                    className="rounded p-1 text-ink-muted/50 transition hover:bg-gray-100 hover:text-gray-500"
                    onClick={() => handleDiscard(entry.run_id)}
                    title="标记为已废弃"
                    type="button"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <button
                  className="rounded p-1 text-ink-muted/50 transition hover:bg-red/10 hover:text-amber"
                  onClick={() => handleDelete(entry.run_id)}
                  title="删除"
                  type="button"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
