"use client";

import { useState, useCallback, useMemo, useEffect, Fragment } from "react";
import { InputPanel, type InitialInputSource } from "./InputPanel";
import { MarkdownPreview } from "./MarkdownPreview";
import { JsonViewer } from "./JsonViewer";
import { StructuredReportView } from "./StructuredReportView";
import { CopyButton } from "./CopyButton";
import { DownloadButton } from "./DownloadButton";
import { HistoryPanel } from "./HistoryPanel";
import { AssetDraftPanel } from "./AssetDraftPanel";
import { AssetLibrary } from "./AssetLibrary";
import { MissionPanel } from "./MissionPanel";
import { ReviewPanel } from "./ReviewPanel";
import { AgentStepProgress, parseAgentSteps } from "./AgentStepProgress";
import type { AgentProgressStep } from "./AgentStepProgress";
import { AgentOutputCards } from "./AgentOutputCards";
import type { AnalyzeInput, AnalyzeResponse } from "../lib/analyze-types";
import type { RunLog } from "../lib/run-log";
import type { Correction } from "../lib/correction-store";
import { saveToHistory, loadHistory, updateHistoryStatus } from "../lib/history-store";
import type { HistoryStatus } from "../lib/history-store";
import { extractAssetFromResponse } from "../lib/extract-asset";
import type { CognitiveAsset } from "../lib/extract-asset";
import { confirmAssetDraft } from "../lib/asset-confirmation";
import { hasAssetFromRun } from "../lib/asset-store";
import { Separator } from "./ui/separator";
import type { PreferenceRule } from "../lib/preference-rule-store";
import { loadCorrections, saveCorrection } from "../lib/correction-store";
import { assignReportToMission, getMissionForReport } from "../lib/mission-store";
import { buildMarkdownFromAnalysisJson } from "../lib/analysis-markdown";
import {
  loadPreferenceRules,
  savePreferenceRule,
  confirmPreferenceRule,
  disablePreferenceRule,
  enablePreferenceRule,
  deletePreferenceRule,
  getConfirmedRules,
  updatePreferenceRule,
} from "../lib/preference-rule-store";

type TabKey = "report" | "markdown" | "json" | "raw" | "agents";

const tabs: { key: TabKey; label: string }[] = [
  { key: "report", label: "Report" },
  { key: "json", label: "JSON" },
  { key: "markdown", label: "Markdown" },
  { key: "raw", label: "Raw" },
  { key: "agents", label: "Agents" },
];

function statusBadge(status: string) {
  if (status === "success") return "bg-blue/15 text-blue";
  if (status === "failed") return "bg-amber/15 text-amber";
  if (status === "partial") return "bg-amber/10 text-amber";
  return "bg-surface-2 text-ink-muted";
}

function RunLogPanel({ runLog }: { runLog: RunLog }) {
  const hasError = Boolean(runLog.error_message);
  const [expanded, setExpanded] = useState(hasError);
  const inputChars = runLog.input_snapshot.originalGoal.length + runLog.input_snapshot.conversation.length;
  const rows: { label: string; value: React.ReactNode }[] = [
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
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
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
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {rows.map((row) => (
              <span key={row.label} className="contents">
                <dt className="whitespace-nowrap font-medium text-ink-muted">{row.label}</dt>
                <dd className="break-all text-ink">{row.value}</dd>
              </span>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

type TraceSummaryData = {
  mission_detected?: boolean | string;
  analysis_path?: string;
  key_evidence_used?: string | string[];
  policy_checks?: string | string[];
  uncertainties?: string | string[];
};

function extractTraceSummary(json: unknown): TraceSummaryData | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const ts = obj.trace_summary;
  if (!ts || typeof ts !== "object") return null;
  const t = ts as Record<string, unknown>;
  return {
    mission_detected: t.mission_detected as boolean | string | undefined,
    analysis_path: t.analysis_path as string | undefined,
    key_evidence_used: t.key_evidence_used as string | string[] | undefined,
    policy_checks: t.policy_checks as string | string[] | undefined,
    uncertainties: t.uncertainties as string | string[] | undefined,
  };
}

function formatListValue(value: string | string[] | undefined): string {
  if (!value) return "—";
  if (Array.isArray(value)) return value.join("；");
  return String(value);
}

function TraceSummaryPanel({ traceSummary }: { traceSummary: TraceSummaryData }) {
  const evidenceCount = Array.isArray(traceSummary.key_evidence_used)
    ? traceSummary.key_evidence_used.length
    : traceSummary.key_evidence_used
      ? 1
      : 0;
  const uncertaintyCount = Array.isArray(traceSummary.uncertainties)
    ? traceSummary.uncertainties.length
    : traceSummary.uncertainties
      ? 1
      : 0;
  const rows: { label: string; value: string }[] = [
    { label: "是否识别到任务", value: String(traceSummary.mission_detected ?? "—") },
    { label: "分析路径", value: traceSummary.analysis_path ?? "—" },
    { label: "关键证据", value: formatListValue(traceSummary.key_evidence_used) },
    { label: "策略检查", value: formatListValue(traceSummary.policy_checks) },
    { label: "不确定性", value: formatListValue(traceSummary.uncertainties) },
  ];

  return (
    <div className="rounded-lg bg-surface-2/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Evidence Trail</p>
      <h3 className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">Trace Summary（轨迹摘要）</h3>
      <p className="mb-3 mt-1 text-xs text-ink-muted">系统判断依据，用于复盘分析路径、证据和不确定性。</p>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
          <p className="text-sm font-semibold text-ink">{traceSummary.mission_detected ? "是" : "否"}</p>
          <p className="text-[10px] text-ink-muted">mission</p>
        </div>
        <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
          <p className="text-sm font-semibold text-ink">{evidenceCount}</p>
          <p className="text-[10px] text-ink-muted">evidence</p>
        </div>
        <div className="rounded-md border border-line bg-surface-1 px-2 py-1.5">
          <p className="text-sm font-semibold text-ink">{uncertaintyCount}</p>
          <p className="text-[10px] text-ink-muted">uncertain</p>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map((row) => (
          <span key={row.label} className="contents">
            <dt className="whitespace-nowrap font-medium text-ink-muted">{row.label}</dt>
            <dd className="break-all text-ink">{row.value}</dd>
          </span>
        ))}
      </dl>
    </div>
  );
}

function PreferenceRulePanel({ refreshKey }: { refreshKey: number }) {
  const [rules, setRules] = useState<PreferenceRule[]>([]);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    setRules(loadPreferenceRules());
  }, [refreshKey]);

  function reloadRules() {
    setRules(loadPreferenceRules());
    setLocalRefresh((k) => k + 1);
  }

  const drafts = rules.filter((r) => r.status === "draft");
  const confirmed = rules.filter((r) => r.status === "confirmed");
  const disabled = rules.filter((r) => r.status === "disabled");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  function handleConfirm(id: string) {
    confirmPreferenceRule(id);
    reloadRules();
  }

  function handleDisable(id: string) {
    disablePreferenceRule(id);
    reloadRules();
  }

  function handleEnable(id: string) {
    enablePreferenceRule(id);
    reloadRules();
  }

  function handleDelete(id: string) {
    deletePreferenceRule(id);
    reloadRules();
  }

  function startEdit(rule: PreferenceRule) {
    setEditingId(rule.id);
    setEditContent(rule.content);
  }

  function saveEdit(id: string) {
    if (!editContent.trim()) return;
    updatePreferenceRule(id, { content: editContent.trim() });
    setEditingId(null);
    reloadRules();
  }

  return (
    <div className="rounded-lg bg-surface-2/50 p-3">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">偏好规则</h3>
      <p className="mb-3 text-xs text-ink-muted">已确认的规则会在后续分析时自动注入 prompt。</p>

      {drafts.length > 0 && (
        <div className="mb-3">
          <h4 className="mb-1 text-xs font-semibold text-amber">待确认草稿</h4>
          <div className="space-y-2">
            {drafts.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-amber/20 bg-amber/5 px-3 py-2">
                <p className="text-xs text-ink">{rule.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="rounded-md bg-blue px-2.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-blue/80"
                    onClick={() => handleConfirm(rule.id)}
                    type="button"
                  >
                    确认
                  </button>
                  <button
                    className="rounded-md border border-line px-2.5 py-0.5 text-[10px] font-medium text-ink-muted transition hover:bg-surface-2"
                    onClick={() => startEdit(rule)}
                    type="button"
                  >
                    编辑
                  </button>
                  <button
                    className="rounded-md border border-amber/30 px-2.5 py-0.5 text-[10px] font-medium text-amber transition hover:bg-amber/10"
                    onClick={() => handleDelete(rule.id)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
                {editingId === rule.id && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      className="w-full rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none focus:border-blue"
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      value={editContent}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-md bg-blue px-2.5 py-0.5 text-[10px] font-semibold text-white"
                        onClick={() => saveEdit(rule.id)}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="rounded-md border border-line px-2.5 py-0.5 text-[10px] font-medium text-ink-muted"
                        onClick={() => setEditingId(null)}
                        type="button"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="mb-3">
          <h4 className="mb-1 text-xs font-semibold text-blue">已生效规则</h4>
          <div className="space-y-2">
            {confirmed.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-blue/20 bg-blue/5 px-3 py-2">
                <p className="text-xs text-ink">{rule.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="rounded-md border border-line px-2.5 py-0.5 text-[10px] font-medium text-ink-muted transition hover:bg-surface-2"
                    onClick={() => startEdit(rule)}
                    type="button"
                  >
                    编辑
                  </button>
                  <button
                    className="rounded-md border border-amber/30 px-2.5 py-0.5 text-[10px] font-medium text-amber transition hover:bg-amber/10"
                    onClick={() => handleDisable(rule.id)}
                    type="button"
                  >
                    禁用
                  </button>
                </div>
                {editingId === rule.id && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      className="w-full rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none focus:border-blue"
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      value={editContent}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-md bg-blue px-2.5 py-0.5 text-[10px] font-semibold text-white"
                        onClick={() => saveEdit(rule.id)}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="rounded-md border border-line px-2.5 py-0.5 text-[10px] font-medium text-ink-muted"
                        onClick={() => setEditingId(null)}
                        type="button"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {disabled.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-ink-muted">已禁用规则</h4>
          <div className="space-y-2">
            {disabled.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-line bg-surface-3/50 px-3 py-2 opacity-60">
                <p className="text-xs text-ink-muted">{rule.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="rounded-md border border-blue/30 px-2.5 py-0.5 text-[10px] font-medium text-blue transition hover:bg-blue/10"
                    onClick={() => handleEnable(rule.id)}
                    type="button"
                  >
                    重新启用
                  </button>
                  <button
                    className="rounded-md border border-amber/30 px-2.5 py-0.5 text-[10px] font-medium text-amber transition hover:bg-amber/10"
                    onClick={() => handleDelete(rule.id)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rules.length === 0 && (
        <p className="text-xs text-ink-muted">暂无偏好规则。通过强纠正可自动生成规则草稿。</p>
      )}
    </div>
  );
}

function CorrectionPanel({ reportId, existingCorrections, onCorrectionAdded }: {
  reportId: string;
  existingCorrections: Correction[];
  onCorrectionAdded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [correctionType, setCorrectionType] = useState<"minor_correction" | "strong_correction">("minor_correction");
  const [target, setTarget] = useState<Correction["target"]>("asset_type");
  const [originalValue, setOriginalValue] = useState("");
  const [correctedValue, setCorrectedValue] = useState("");
  const [reason, setReason] = useState("");

  function resetForm() {
    setShowForm(false);
    setOriginalValue("");
    setCorrectedValue("");
    setReason("");
    setCorrectionType("minor_correction");
    setTarget("asset_type");
  }

  function handleSubmit() {
    if (!reason.trim()) return;
    const saved = saveCorrection({
      reportId,
      correctionType,
      target,
      originalValue: originalValue || null,
      correctedValue: correctedValue || null,
      reason: reason.trim(),
    });
    if (saved && correctionType === "strong_correction") {
      const targetLabel = targetLabels[target];
      const ruleDraft = `当系统判断${targetLabel}为「${originalValue || "—"}」时，应考虑用户可能认为是「${correctedValue || "—"}」。原因：${reason.trim()}`;
      savePreferenceRule({
        content: ruleDraft,
        sourceCorrectionId: saved.id,
        status: "draft",
        confirmedAt: null,
      });
    }
    resetForm();
    onCorrectionAdded();
  }

  const targetLabels: Record<Correction["target"], string> = {
    intent: "任务意图",
    depth_score: "深度评分",
    asset_type: "资产类型",
    misconception: "误区标记",
    update_proposal: "更新提议",
  };

  return (
    <div className="rounded-lg bg-surface-2/50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">纠正记录</h3>
        {!showForm && (
          <button
            className="rounded-md border border-line px-3 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2"
            onClick={() => setShowForm(true)}
            type="button"
          >
            添加纠正
          </button>
        )}
      </div>

      {existingCorrections.length > 0 && (
        <div className="mb-3 space-y-2">
          {existingCorrections.map((c) => (
            <div key={c.id} className={`rounded-lg border px-3 py-2 text-xs ${
              c.correctionType === "strong_correction" ? "border-amber/20 bg-amber/5" : "border-line bg-surface-1"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.correctionType === "strong_correction" ? "bg-amber/15 text-amber" : "bg-surface-2 text-ink-muted"
                }`}>
                  {c.correctionType === "strong_correction" ? "强纠正" : "小纠正"}
                </span>
                <span className="font-medium text-ink-muted">{targetLabels[c.target]}</span>
                <span className="ml-auto text-ink-muted/50">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-ink-muted">
                {c.originalValue != null ? String(c.originalValue) : "—"} → {c.correctedValue != null ? String(c.correctedValue) : "—"}
              </div>
              <div className="mt-0.5 text-ink">{c.reason}</div>
            </div>
          ))}
        </div>
      )}

      {existingCorrections.length === 0 && !showForm && (
        <p className="text-xs text-ink-muted">暂无纠正记录。如需修正系统判断，点击"添加纠正"。</p>
      )}

      {showForm && (
        <div className="space-y-2 rounded-lg bg-surface-1 p-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <input checked={correctionType === "minor_correction"} name="corrType" onChange={() => setCorrectionType("minor_correction")} type="radio" />
              小纠正
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <input checked={correctionType === "strong_correction"} name="corrType" onChange={() => setCorrectionType("strong_correction")} type="radio" />
              强纠正
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">纠正目标</label>
            <select
              className="ml-2 rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none focus:border-blue"
              onChange={(e) => setTarget(e.target.value as Correction["target"])}
              value={target}
            >
              {Object.entries(targetLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">原始值</label>
            <input
              className="ml-2 rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none focus:border-blue"
              onChange={(e) => setOriginalValue(e.target.value)}
              placeholder="系统原来的判断"
              value={originalValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">纠正值</label>
            <input
              className="ml-2 rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none focus:border-blue"
              onChange={(e) => setCorrectedValue(e.target.value)}
              placeholder="你认为正确的值"
              value={correctedValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">纠正原因</label>
            <textarea
              className="mt-1 w-full rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none focus:border-blue"
              onChange={(e) => setReason(e.target.value)}
              placeholder="为什么需要纠正？"
              rows={2}
              value={reason}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md bg-blue px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue/80 disabled:opacity-50"
              disabled={!reason.trim()}
              onClick={handleSubmit}
              type="button"
            >
              保存纠正
            </button>
            <button
              className="rounded-md border border-line px-3 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2"
              onClick={resetForm}
              type="button"
            >
              取消
            </button>
          </div>
          {correctionType === "strong_correction" && (
            <p className="text-[10px] text-amber">强纠正可能生成用户偏好规则草稿，需确认后保存。</p>
          )}
        </div>
      )}
    </div>
  );
}

function AssetDecisionBanner({ result, draftAsset, assetRefreshKey, onConfirm, onDiscard, currentMissionId }: {
  result: AnalyzeResponse | null;
  draftAsset: ReturnType<typeof extractAssetFromResponse>;
  assetRefreshKey: number;
  onConfirm: () => void;
  onDiscard: () => void;
  currentMissionId?: string | null;
}) {
  if (!result) return null;

  const sourceRunId = result.runLog?.run_id;
  const alreadySaved = sourceRunId ? hasAssetFromRun(sourceRunId) : false;

  if ((result.parseStatus !== "success" && result.parseStatus !== "partial") || !result.json) {
    return (
      <div className="border-t border-line p-5">
        <div className="flex items-center gap-2.5">
          <svg className="h-4 w-4 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm text-ink-muted">JSON 解析未成功，无法判断资产候选</span>
        </div>
      </div>
    );
  }

  const json = result.json as Record<string, unknown>;
  const decision = json.asset_decision as Record<string, unknown> | undefined;

  if (draftAsset) {
    if (alreadySaved) {
      return (
        <div className="border-t border-line p-5">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 text-blue" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium text-blue">该对话的资产已入库</span>
            <span className="text-xs text-ink-muted">— 不会重复添加</span>
          </div>
        </div>
      );
    }

    const recommendedType = decision?.recommended_asset_type as string | undefined;
    return (
      <div className="border-t border-line p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <svg className="h-5 w-5 text-blue" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="text-sm font-semibold text-ink">资产候选</h3>
          {recommendedType && recommendedType !== "none" && (
            <span className="inline-block rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-medium text-blue">
              {recommendedType}
            </span>
          )}
          {!decision && (
            <span className="inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              扁平结构
            </span>
          )}
        </div>
        <AssetDraftPanel key={draftAsset.asset_id} asset={draftAsset} onConfirm={onConfirm} onDiscard={onDiscard} currentMissionId={currentMissionId} />
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="border-t border-line p-5">
        <div className="flex items-start gap-2.5">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <span className="text-sm text-ink-muted">本次分析未产生资产候选</span>
            <p className="mt-1 text-xs text-ink-muted">模型输出中未包含可提取的资产数据。</p>
          </div>
        </div>
      </div>
    );
  }

  const whyNot = (decision.why_worth_saving as string | undefined) ?? (decision.reason as string | undefined);

  return (
    <div className="border-t border-line p-5">
      <div className="flex items-start gap-2.5">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <span className="text-sm text-ink-muted">本次分析未达到资产候选门槛</span>
          {whyNot && <p className="mt-1 text-xs text-ink-muted">{whyNot}</p>}
        </div>
      </div>
    </div>
  );
}

type AnalysisWorkbenchProps = {
  currentMissionId?: string | null;
  onSelectMission?: (missionId: string | null) => void;
  initialInputOverride?: Partial<AnalyzeInput>;
  initialInputSource?: InitialInputSource;
};

export function AnalysisWorkbench({ currentMissionId: externalMissionId, onSelectMission, initialInputOverride, initialInputSource }: AnalysisWorkbenchProps) {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("report");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [dismissedDraft, setDismissedDraft] = useState(false);
  const [correctionRefreshKey, setCorrectionRefreshKey] = useState(0);
  const [internalMissionId, setInternalMissionId] = useState<string | null>(null);
  const [missionRefreshKey, setMissionRefreshKey] = useState(0);
  const [agentProgress, setAgentProgress] = useState<AgentProgressStep[]>([]);
  const [leftTab, setLeftTab] = useState<"history" | "mission">("history");
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentReportStatus, setCurrentReportStatus] = useState<HistoryStatus>("draft");

  const currentMissionId = externalMissionId ?? internalMissionId;
  const setCurrentMissionId = onSelectMission ?? setInternalMissionId;

  const traceSummary = useMemo(() => {
    if (!result?.json) return null;
    return extractTraceSummary(result.json);
  }, [result]);

  const agentSteps = useMemo(() => {
    return parseAgentSteps(result?.raw);
  }, [result]);

  const isMultiAgent = agentSteps.length > 0;

  const assetAlreadySaved = currentRunId ? hasAssetFromRun(currentRunId) : false;
  const corrections = useMemo(() => {
    if (!currentRunId) return [];
    return loadCorrections(currentRunId);
  }, [currentRunId, correctionRefreshKey]);

  const draftAsset = useMemo(() => {
    if (!result?.runLog || dismissedDraft) return null;
    return extractAssetFromResponse(result, result.runLog.run_id);
  }, [result, dismissedDraft]);

  const runStatus = useMemo(() => {
    if (isLoading) return { label: "分析运行中", tone: "bg-blue/15 text-blue" };
    if (!result) return { label: "等待输入", tone: "bg-surface-2 text-ink-muted" };
    if (result.error) return { label: "需要检查", tone: "bg-amber/15 text-amber" };
    if (result.parseStatus === "success" || result.parseStatus === "partial") {
      return { label: "报告已生成", tone: "bg-moss/15 text-moss" };
    }
    return { label: "等待解析", tone: "bg-surface-2 text-ink-muted" };
  }, [isLoading, result]);

  const handleAnalyzeFinish = useCallback((response: AnalyzeResponse) => {
    setResult(response);
    setIsLoading(false);
    setDismissedDraft(false);
    setAgentProgress([]);
    const steps = parseAgentSteps(response.raw);
    if (steps.length > 0) {
      setActiveTab("agents");
    } else {
      setActiveTab("report");
    }
    if (response.runLog) {
      saveToHistory({
        run_id: response.runLog.run_id,
        created_at: response.runLog.created_at,
        input_snapshot: response.runLog.input_snapshot,
        analyzeResponse: response,
        status: "draft",
      });
      setCurrentRunId(response.runLog.run_id);
      setCurrentReportStatus("draft");
      setHistoryRefreshKey((k) => k + 1);
      if (currentMissionId) {
        assignReportToMission(currentMissionId, response.runLog.run_id);
        setMissionRefreshKey((k) => k + 1);
      }
    }
  }, [currentMissionId]);

  const handleHistorySelect = useCallback((response: AnalyzeResponse, runId: string, status: HistoryStatus) => {
    setResult(response);
    setCurrentRunId(runId);
    setCurrentReportStatus(status);
    setIsLoading(false);
    setDismissedDraft(false);
  }, []);

  const handleNavigateToHistory = useCallback((sourceRunId: string) => {
    const history = loadHistory();
    const entry = history.find((h) => h.run_id === sourceRunId);
    if (entry) {
      setResult(entry.analyzeResponse);
      setCurrentRunId(entry.run_id);
      setCurrentReportStatus(entry.status);
      setIsLoading(false);
      setActiveTab("report");
    }
  }, []);

  const handleAnalyzeStart = useCallback(() => {
    setIsLoading(true);
    setResult(null);
    setAgentProgress([]);
  }, []);

  const handleConfirmAsset = useCallback(() => {
    setAssetRefreshKey((k) => k + 1);
  }, []);

  const handleConfirmDraftAsset = useCallback((asset: CognitiveAsset) => {
    confirmAssetDraft(asset, currentMissionId);
    setAssetRefreshKey((k) => k + 1);
  }, [currentMissionId]);

  const handleAssetsChanged = useCallback(() => {
    setAssetRefreshKey((k) => k + 1);
  }, []);

  const handleDiscardAsset = useCallback(() => {
    setDismissedDraft(true);
  }, []);

  const handleCorrectionAdded = useCallback(() => {
    setCorrectionRefreshKey((k) => k + 1);
  }, []);

  const handleMarkReviewed = useCallback(() => {
    if (!currentRunId) return;
    updateHistoryStatus(currentRunId, "reviewed");
    setCurrentReportStatus("reviewed");
    setHistoryRefreshKey((k) => k + 1);
  }, [currentRunId]);

  const handleMarkDiscarded = useCallback(() => {
    if (!currentRunId) return;
    updateHistoryStatus(currentRunId, "discarded");
    setCurrentReportStatus("discarded");
    setHistoryRefreshKey((k) => k + 1);
  }, [currentRunId]);

  const handleRestoreReport = useCallback(() => {
    if (!currentRunId) return;
    updateHistoryStatus(currentRunId, "draft");
    setCurrentReportStatus("draft");
    setHistoryRefreshKey((k) => k + 1);
  }, [currentRunId]);

  const handleHistoryStatusChange = useCallback((runId: string, newStatus: HistoryStatus) => {
    if (runId === currentRunId) {
      setCurrentReportStatus(newStatus);
    }
  }, [currentRunId]);

  function getCopyContent(): string | null {
    if (!result) return null;
    if (activeTab === "report") return buildMarkdownFromAnalysisJson(result.json);
    if (activeTab === "markdown") return result.markdown ?? buildMarkdownFromAnalysisJson(result.json);
    if (activeTab === "json") return result.json != null ? JSON.stringify(result.json, null, 2) : null;
    if (activeTab === "raw") return result.raw;
    return null;
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="w-full shrink-0 space-y-4 border-b border-line bg-surface-1 p-4 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto">
        <div className="rounded-lg border border-line bg-surface-2/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Workflow</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">分析任务流</h2>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px] text-ink-muted">
            <div className="rounded-md bg-surface-1 px-2 py-1.5">
              <span className="block font-semibold text-ink">1</span>
              输入
            </div>
            <div className="rounded-md bg-surface-1 px-2 py-1.5">
              <span className="block font-semibold text-ink">2</span>
              报告
            </div>
            <div className="rounded-md bg-surface-1 px-2 py-1.5">
              <span className="block font-semibold text-ink">3</span>
              Mission
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface-2/50 p-3">
          <button
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted"
            onClick={() => setInputCollapsed(!inputCollapsed)}
            type="button"
          >
            输入
            <svg
              className={`h-3.5 w-3.5 transition-transform ${inputCollapsed ? "" : "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {!inputCollapsed && (
            <div className="mt-3">
              <InputPanel
                onAnalyzeStart={handleAnalyzeStart}
                onAnalyzeFinish={handleAnalyzeFinish}
                onAgentProgress={setAgentProgress}
                currentMissionId={currentMissionId}
                initialInputOverride={initialInputOverride}
                initialInputSource={initialInputSource}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg bg-surface-2/50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Navigation</span>
            <div className="flex items-center">
            <button
              className={`relative px-3 py-1.5 text-xs font-semibold transition ${
                leftTab === "history" ? "text-blue" : "text-ink-muted hover:text-ink"
              }`}
              onClick={() => setLeftTab("history")}
              type="button"
            >
              历史
              {leftTab === "history" && (
                <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-blue" />
              )}
            </button>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <button
              className={`relative px-3 py-1.5 text-xs font-semibold transition ${
                leftTab === "mission" ? "text-blue" : "text-ink-muted hover:text-ink"
              }`}
              onClick={() => setLeftTab("mission")}
              type="button"
            >
              任务
              {leftTab === "mission" && (
                <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-blue" />
              )}
            </button>
            </div>
          </div>
          {leftTab === "history" && <HistoryPanel onSelect={handleHistorySelect} onStatusChange={handleHistoryStatusChange} refreshKey={historyRefreshKey} />}
          {leftTab === "mission" && (
            <MissionPanel
              currentMissionId={currentMissionId}
              onSelectMission={setCurrentMissionId}
              refreshKey={missionRefreshKey}
            />
          )}
        </div>

        <div className="rounded-lg bg-surface-2/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">资产库</p>
          <p className="mt-1 text-[10px] text-ink-muted">在右侧面板查看完整资产库</p>
        </div>
      </div>

      <div className="flex min-h-[520px] min-w-0 flex-1 flex-col">
        <div className="border-b border-line bg-surface-1 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue">Offline Mission Analysis</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">离线任务分析工作台</h1>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                输入对话，生成 Mission Review、DepthScore 与认知资产候选。JSON 是事实来源，Markdown 由 JSON 导出，Raw / Run Log 用于追踪。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${runStatus.tone}`}>{runStatus.label}</span>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-muted">
                {currentMissionId ? "Mission 已关联" : "未关联 Mission"}
              </span>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-muted">
                {isMultiAgent ? "多 Agent 结果" : "单 Prompt / 待运行"}
              </span>
            </div>
          </div>
        </div>
        <header className="sticky top-0 z-10 flex shrink-0 items-center border-b border-line bg-surface-1 px-5">
          <div className="flex items-center">
            {tabs.map((tab, i) => (
              <Fragment key={tab.key}>
                {i > 0 && <Separator orientation="vertical" className="mx-1 h-4" />}
                <button
                  className={`relative px-4 py-3 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "text-blue"
                      : "text-ink-muted hover:text-ink"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue" />
                  )}
                </button>
              </Fragment>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DownloadButton result={result} />
            <CopyButton content={getCopyContent()} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {activeTab === "report" && (
            <div className="p-5">
              <StructuredReportView
                assetAlreadySaved={assetAlreadySaved}
                assetCandidateDismissed={dismissedDraft}
                draftAsset={draftAsset}
                isLoading={isLoading}
                json={result?.json ?? null}
                missionTitle={currentRunId ? (getMissionForReport(currentRunId)?.title ?? null) : null}
                onConfirmDraftAsset={handleConfirmDraftAsset}
                onDiscardDraftAsset={handleDiscardAsset}
                onMarkDiscarded={handleMarkDiscarded}
                onMarkReviewed={handleMarkReviewed}
                onRestoreReport={handleRestoreReport}
                parseStatus={result?.parseStatus ?? "not_attempted"}
                reportStatus={currentRunId ? currentReportStatus : undefined}
                runId={currentRunId || undefined}
              />
            </div>
          )}
          {activeTab === "markdown" && (
            <div className="p-5">
              <MarkdownPreview isLoading={isLoading} markdown={result?.markdown ?? buildMarkdownFromAnalysisJson(result?.json) ?? null} unstyled />
            </div>
          )}
          {activeTab === "json" && (
            <div className="p-5">
              <h2 className="mb-3 text-base font-semibold">JSON Viewer</h2>
              <JsonViewer
                json={result?.json ?? null}
                parseStatus={result?.parseStatus ?? "not_attempted"}
                raw={result?.raw ?? null}
              />
            </div>
          )}
          {activeTab === "raw" && (
            <div className="p-5">
              <h2 className="mb-3 text-base font-semibold">Raw Output</h2>
              {result?.raw ? (
                <pre className="overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-4 text-sm leading-6 text-white">
                  {result.raw}
                </pre>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 text-sm text-ink-muted">
                  暂无原始输出。提交输入后，模型的原始返回会显示在这里。
                </div>
              )}
            </div>
          )}
          {activeTab === "agents" && (
            <div className="p-5">
              {isMultiAgent ? (
                <div className="space-y-6">
                  <AgentStepProgress steps={agentSteps} progressSteps={undefined} />
                  <AgentOutputCards steps={agentSteps} />
                </div>
              ) : isLoading && agentProgress.length > 0 ? (
                <div className="space-y-6">
                  <AgentStepProgress steps={[]} progressSteps={agentProgress} />
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface-2 text-sm text-ink-muted">
                  <svg className="h-8 w-8 text-ink-muted/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>此分析结果来自单 Prompt 模式，无 Agent 步骤信息。</span>
                  <span className="text-xs text-ink-muted">切换到"多 Agent"模式后，Agent 步骤和输出卡片将在此展示。</span>
                </div>
              )}
            </div>
          )}
        </div>

        <AssetDecisionBanner
          result={result}
          draftAsset={draftAsset}
          assetRefreshKey={assetRefreshKey}
          onConfirm={handleConfirmAsset}
          onDiscard={handleDiscardAsset}
          currentMissionId={currentMissionId}
        />
      </div>

      <div className="w-full shrink-0 space-y-4 border-t border-line bg-surface-1 p-4 lg:w-80 lg:border-l lg:border-t-0 lg:overflow-y-auto">
        {result?.runLog && <RunLogPanel runLog={result.runLog} />}
        {traceSummary && <TraceSummaryPanel traceSummary={traceSummary} />}
        {currentRunId && (
          <CorrectionPanel
            existingCorrections={corrections}
            onCorrectionAdded={handleCorrectionAdded}
            reportId={currentRunId}
          />
        )}
        <PreferenceRulePanel refreshKey={correctionRefreshKey} />
        <ReviewPanel refreshKey={assetRefreshKey} />
        <AssetLibrary
          refreshKey={assetRefreshKey}
          onNavigateToHistory={handleNavigateToHistory}
          onAssetsChanged={handleAssetsChanged}
        />
      </div>
    </div>
  );
}
