"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { InputPanel } from "./InputPanel";
import { MarkdownPreview } from "./MarkdownPreview";
import { JsonViewer } from "./JsonViewer";
import { CopyButton } from "./CopyButton";
import { DownloadButton } from "./DownloadButton";
import { HistoryPanel } from "./HistoryPanel";
import { AssetDraftPanel } from "./AssetDraftPanel";
import { AssetLibrary } from "./AssetLibrary";
import { MissionPanel } from "./MissionPanel";
import { AgentStepProgress, parseAgentSteps } from "./AgentStepProgress";
import type { AgentProgressStep } from "./AgentStepProgress";
import { AgentOutputCards } from "./AgentOutputCards";
import type { AnalyzeInput, AnalyzeResponse } from "../lib/analyze-types";
import type { RunLog } from "../lib/run-log";
import type { Correction } from "../lib/correction-store";
import { saveToHistory, loadHistory } from "../lib/history-store";
import { extractAssetFromResponse } from "../lib/extract-asset";
import { hasAssetFromRun } from "../lib/asset-store";
import type { PreferenceRule } from "../lib/preference-rule-store";
import { loadCorrections, saveCorrection } from "../lib/correction-store";
import { assignReportToMission } from "../lib/mission-store";
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

type TabKey = "markdown" | "json" | "raw" | "agents";

const tabs: { key: TabKey; label: string }[] = [
  { key: "markdown", label: "Markdown" },
  { key: "json", label: "JSON" },
  { key: "raw", label: "Raw" },
  { key: "agents", label: "Agents" },
];

function statusBadge(status: string) {
  if (status === "success") return "bg-moss/15 text-moss";
  if (status === "failed") return "bg-rust/15 text-rust";
  if (status === "partial") return "bg-amber-50 text-amber-800";
  return "bg-ink/5 text-ink/50";
}

function RunLogPanel({ runLog }: { runLog: RunLog }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Run ID", value: <code className="text-xs">{runLog.run_id}</code> },
    { label: "Created At", value: runLog.created_at },
    { label: "Prompt Version", value: runLog.prompt_version },
    { label: "Model", value: runLog.model_name },
    {
      label: "Request Status",
      value: (
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadge(runLog.request_status)}`}>
          {runLog.request_status}
        </span>
      ),
    },
    {
      label: "Parse Status",
      value: (
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadge(runLog.parse_status)}`}>
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
    rows.push({ label: "Error", value: <span className="text-red-700">{truncated}</span> });
  }

  return (
    <div className="rounded-lg border border-line bg-paper/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">Run Log</h3>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map((row) => (
          <span key={row.label} className="contents">
            <dt className="whitespace-nowrap font-medium text-ink/60">{row.label}</dt>
            <dd className="break-all text-ink">{row.value}</dd>
          </span>
        ))}
      </dl>
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
  const rows: { label: string; value: string }[] = [
    { label: "是否识别到任务", value: String(traceSummary.mission_detected ?? "—") },
    { label: "分析路径", value: traceSummary.analysis_path ?? "—" },
    { label: "关键证据", value: formatListValue(traceSummary.key_evidence_used) },
    { label: "策略检查", value: formatListValue(traceSummary.policy_checks) },
    { label: "不确定性", value: formatListValue(traceSummary.uncertainties) },
  ];

  return (
    <div className="rounded-lg border border-ink/15 bg-ink/5 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">Trace Summary（轨迹摘要）</h3>
      <p className="mb-3 text-xs text-ink/50">系统判断依据</p>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map((row) => (
          <span key={row.label} className="contents">
            <dt className="whitespace-nowrap font-medium text-ink/60">{row.label}</dt>
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
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">偏好规则</h3>
      <p className="mb-3 text-xs text-ink/50">已确认的规则会在后续分析时自动注入 prompt。</p>

      {drafts.length > 0 && (
        <div className="mb-3">
          <h4 className="mb-1 text-xs font-semibold text-amber-700">待确认草稿</h4>
          <div className="space-y-2">
            {drafts.map((rule) => (
              <div key={rule.id} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-ink">{rule.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="rounded bg-moss px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-moss/90"
                    onClick={() => handleConfirm(rule.id)}
                    type="button"
                  >
                    确认
                  </button>
                  <button
                    className="rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink/60 transition hover:bg-paper"
                    onClick={() => startEdit(rule)}
                    type="button"
                  >
                    编辑
                  </button>
                  <button
                    className="rounded border border-rust/30 px-2 py-0.5 text-[10px] font-medium text-rust transition hover:bg-rust/10"
                    onClick={() => handleDelete(rule.id)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
                {editingId === rule.id && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      className="w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none"
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      value={editContent}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded bg-moss px-2 py-0.5 text-[10px] font-semibold text-white"
                        onClick={() => saveEdit(rule.id)}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink/60"
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
          <h4 className="mb-1 text-xs font-semibold text-moss">已生效规则</h4>
          <div className="space-y-2">
            {confirmed.map((rule) => (
              <div key={rule.id} className="rounded border border-moss/30 bg-moss/5 px-3 py-2">
                <p className="text-xs text-ink">{rule.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink/60 transition hover:bg-paper"
                    onClick={() => startEdit(rule)}
                    type="button"
                  >
                    编辑
                  </button>
                  <button
                    className="rounded border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-700 transition hover:bg-amber-50"
                    onClick={() => handleDisable(rule.id)}
                    type="button"
                  >
                    禁用
                  </button>
                </div>
                {editingId === rule.id && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      className="w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none"
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      value={editContent}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded bg-moss px-2 py-0.5 text-[10px] font-semibold text-white"
                        onClick={() => saveEdit(rule.id)}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink/60"
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
          <h4 className="mb-1 text-xs font-semibold text-ink/40">已禁用规则</h4>
          <div className="space-y-2">
            {disabled.map((rule) => (
              <div key={rule.id} className="rounded border border-line bg-paper/40 px-3 py-2 opacity-60">
                <p className="text-xs text-ink/60">{rule.content}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="rounded border border-moss/30 px-2 py-0.5 text-[10px] font-medium text-moss transition hover:bg-moss/10"
                    onClick={() => handleEnable(rule.id)}
                    type="button"
                  >
                    重新启用
                  </button>
                  <button
                    className="rounded border border-rust/30 px-2 py-0.5 text-[10px] font-medium text-rust transition hover:bg-rust/10"
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
        <p className="text-xs text-ink/40">暂无偏好规则。通过强纠正可自动生成规则草稿。</p>
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
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">纠正记录</h3>
        {!showForm && (
          <button
            className="rounded border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
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
            <div key={c.id} className={`rounded border px-3 py-2 text-xs ${
              c.correctionType === "strong_correction" ? "border-amber-300 bg-amber-100/50" : "border-line bg-white"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  c.correctionType === "strong_correction" ? "bg-amber-200 text-amber-800" : "bg-ink/10 text-ink/60"
                }`}>
                  {c.correctionType === "strong_correction" ? "强纠正" : "小纠正"}
                </span>
                <span className="font-medium text-ink/70">{targetLabels[c.target]}</span>
                <span className="ml-auto text-ink/30">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-ink/50">
                {c.originalValue != null ? String(c.originalValue) : "—"} → {c.correctedValue != null ? String(c.correctedValue) : "—"}
              </div>
              <div className="mt-0.5 text-ink/70">{c.reason}</div>
            </div>
          ))}
        </div>
      )}

      {existingCorrections.length === 0 && !showForm && (
        <p className="text-xs text-ink/40">暂无纠正记录。如需修正系统判断，点击"添加纠正"。</p>
      )}

      {showForm && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
              <input checked={correctionType === "minor_correction"} name="corrType" onChange={() => setCorrectionType("minor_correction")} type="radio" />
              小纠正
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
              <input checked={correctionType === "strong_correction"} name="corrType" onChange={() => setCorrectionType("strong_correction")} type="radio" />
              强纠正
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">纠正目标</label>
            <select
              className="ml-2 rounded border border-line px-2 py-1 text-xs text-ink outline-none"
              onChange={(e) => setTarget(e.target.value as Correction["target"])}
              value={target}
            >
              {Object.entries(targetLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">原始值</label>
            <input
              className="ml-2 rounded border border-line px-2 py-1 text-xs text-ink outline-none"
              onChange={(e) => setOriginalValue(e.target.value)}
              placeholder="系统原来的判断"
              value={originalValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">纠正值</label>
            <input
              className="ml-2 rounded border border-line px-2 py-1 text-xs text-ink outline-none"
              onChange={(e) => setCorrectedValue(e.target.value)}
              placeholder="你认为正确的值"
              value={correctedValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">纠正原因</label>
            <textarea
              className="mt-1 w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none"
              onChange={(e) => setReason(e.target.value)}
              placeholder="为什么需要纠正？"
              rows={2}
              value={reason}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              disabled={!reason.trim()}
              onClick={handleSubmit}
              type="button"
            >
              保存纠正
            </button>
            <button
              className="rounded border border-line px-3 py-1 text-xs font-medium text-ink/60 transition hover:bg-paper"
              onClick={resetForm}
              type="button"
            >
              取消
            </button>
          </div>
          {correctionType === "strong_correction" && (
            <p className="text-[10px] text-amber-600">强纠正可能生成用户偏好规则草稿，需确认后保存。</p>
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
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-ink/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm text-ink/50">JSON 解析未成功，无法判断资产候选</span>
        </div>
      </div>
    );
  }

  const json = result.json as Record<string, unknown>;
  const decision = json.asset_decision as Record<string, unknown> | undefined;

  if (draftAsset) {
    if (alreadySaved) {
      return (
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium text-moss">该对话的资产已入库</span>
            <span className="text-xs text-ink/40">— 不会重复添加</span>
          </div>
        </div>
      );
    }

    const recommendedType = decision?.recommended_asset_type as string | undefined;
    return (
      <div className="border-t border-line p-4">
        <div className="mb-3 flex items-center gap-2">
          <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="text-sm font-semibold text-ink">资产候选</h3>
          {recommendedType && recommendedType !== "none" && (
            <span className="inline-block rounded bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss">
              {recommendedType}
            </span>
          )}
          {!decision && (
            <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
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
      <div className="border-t border-line p-4">
        <div className="flex items-start gap-2">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <span className="text-sm text-ink/50">本次分析未产生资产候选</span>
            <p className="mt-1 text-xs text-ink/40">模型输出中未包含可提取的资产数据。</p>
          </div>
        </div>
      </div>
    );
  }

  const whyNot = (decision.why_worth_saving as string | undefined) ?? (decision.reason as string | undefined);

  return (
    <div className="border-t border-line p-4">
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <span className="text-sm text-ink/50">本次分析未达到资产候选门槛</span>
          {whyNot && <p className="mt-1 text-xs text-ink/40">{whyNot}</p>}
        </div>
      </div>
    </div>
  );
}

type AnalysisWorkbenchProps = {
  currentMissionId?: string | null;
  onSelectMission?: (missionId: string | null) => void;
  initialInputOverride?: Partial<AnalyzeInput>;
};

export function AnalysisWorkbench({ currentMissionId: externalMissionId, onSelectMission, initialInputOverride }: AnalysisWorkbenchProps) {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("markdown");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [dismissedDraft, setDismissedDraft] = useState(false);
  const [correctionRefreshKey, setCorrectionRefreshKey] = useState(0);
  const [internalMissionId, setInternalMissionId] = useState<string | null>(null);
  const [missionRefreshKey, setMissionRefreshKey] = useState(0);
  const [agentProgress, setAgentProgress] = useState<AgentProgressStep[]>([]);

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

  const currentRunId = result?.runLog?.run_id ?? "";
  const corrections = useMemo(() => {
    if (!currentRunId) return [];
    return loadCorrections(currentRunId);
  }, [currentRunId, correctionRefreshKey]);

  const draftAsset = useMemo(() => {
    if (!result?.runLog || dismissedDraft) return null;
    return extractAssetFromResponse(result, result.runLog.run_id);
  }, [result, dismissedDraft]);

  const handleAnalyzeFinish = useCallback((response: AnalyzeResponse) => {
    setResult(response);
    setIsLoading(false);
    setDismissedDraft(false);
    setAgentProgress([]);
    const steps = parseAgentSteps(response.raw);
    if (steps.length > 0) {
      setActiveTab("agents");
    }
    if (response.runLog) {
      saveToHistory({
        run_id: response.runLog.run_id,
        created_at: response.runLog.created_at,
        input_snapshot: response.runLog.input_snapshot,
        analyzeResponse: response,
        status: "draft",
      });
      setHistoryRefreshKey((k) => k + 1);
      if (currentMissionId) {
        assignReportToMission(currentMissionId, response.runLog.run_id);
        setMissionRefreshKey((k) => k + 1);
      }
    }
  }, [currentMissionId]);

  const handleHistorySelect = useCallback((response: AnalyzeResponse) => {
    setResult(response);
    setIsLoading(false);
    setDismissedDraft(false);
  }, []);

  const handleNavigateToHistory = useCallback((sourceRunId: string) => {
    const history = loadHistory();
    const entry = history.find((h) => h.run_id === sourceRunId);
    if (entry) {
      setResult(entry.analyzeResponse);
      setIsLoading(false);
      setActiveTab("markdown");
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

  const handleDiscardAsset = useCallback(() => {
    setDismissedDraft(true);
  }, []);

  const handleCorrectionAdded = useCallback(() => {
    setCorrectionRefreshKey((k) => k + 1);
  }, []);

  function getCopyContent(): string | null {
    if (!result) return null;
    if (activeTab === "markdown") return result.markdown;
    if (activeTab === "json") return result.json != null ? JSON.stringify(result.json, null, 2) : null;
    if (activeTab === "raw") return result.raw;
    return null;
  }

  return (
    <div className="grid gap-5 py-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-white/80 p-5 shadow-sm">
        <InputPanel
          onAnalyzeStart={handleAnalyzeStart}
          onAnalyzeFinish={handleAnalyzeFinish}
          onAgentProgress={setAgentProgress}
          currentMissionId={currentMissionId}
          initialInputOverride={initialInputOverride}
        />
        <HistoryPanel onSelect={handleHistorySelect} refreshKey={historyRefreshKey} />
        <MissionPanel
          currentMissionId={currentMissionId}
          onSelectMission={setCurrentMissionId}
          refreshKey={missionRefreshKey}
        />
        <AssetLibrary refreshKey={assetRefreshKey} onNavigateToHistory={handleNavigateToHistory} />
      </section>

      <section className="flex min-h-[420px] flex-col rounded-lg border border-line bg-white/80 shadow-sm">
        <header className="flex shrink-0 items-center gap-1 border-b border-line px-4">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                className={`px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-moss text-moss"
                    : "text-ink/50 hover:text-ink"
                }`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DownloadButton result={result} />
            <CopyButton content={getCopyContent()} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {activeTab === "markdown" && (
            <div className="p-5">
              <MarkdownPreview isLoading={isLoading} markdown={result?.markdown ?? null} unstyled />
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
                <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink p-4 text-sm leading-6 text-white">
                  {result.raw}
                </pre>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-paper text-sm text-ink/60">
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
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line bg-paper text-sm text-ink/60">
                  <svg className="h-8 w-8 text-ink/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>此分析结果来自单 Prompt 模式，无 Agent 步骤信息。</span>
                  <span className="text-xs text-ink/40">切换到"多 Agent"模式后，Agent 步骤和输出卡片将在此展示。</span>
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

        {result?.runLog && (
          <div className="border-t border-line p-4">
            <RunLogPanel runLog={result.runLog} />
          </div>
        )}

        {traceSummary && (
          <div className="border-t border-line p-4">
            <TraceSummaryPanel traceSummary={traceSummary} />
          </div>
        )}

        {currentRunId && (
          <div className="border-t border-line p-4">
            <CorrectionPanel
              existingCorrections={corrections}
              onCorrectionAdded={handleCorrectionAdded}
              reportId={currentRunId}
            />
          </div>
        )}

        <div className="border-t border-line p-4">
          <PreferenceRulePanel refreshKey={correctionRefreshKey} />
        </div>
      </section>
    </div>
  );
}
