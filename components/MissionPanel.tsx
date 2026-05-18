"use client";

import { useState, useEffect } from "react";
import type { Mission, MissionStatus } from "../lib/mission-store";
import {
  loadMissions,
  saveMission,
  updateMission,
  archiveMission,
  deleteMission,
  getReportsForMission,
} from "../lib/mission-store";
import { loadAssets } from "../lib/asset-store";
import { loadHistory } from "../lib/history-store";

const statusLabels: Record<MissionStatus, string> = {
  active: "进行中",
  reviewed: "已复盘",
  asset_generated: "已生成资产",
  archived: "已归档",
};

const statusColors: Record<MissionStatus, string> = {
  active: "bg-blue/10 text-blue border-blue/30",
  reviewed: "bg-blue/10 text-blue border-blue/20",
  asset_generated: "bg-surface-2 text-ink-muted border-line",
  archived: "bg-surface-2 text-ink-muted/70 border-line",
};

type MissionPanelProps = {
  refreshKey: number;
  currentMissionId: string | null;
  onSelectMission: (missionId: string | null) => void;
};

export function MissionPanel({ refreshKey, currentMissionId, onSelectMission }: MissionPanelProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setMissions(loadMissions());
  }, [refreshKey]);

  function reloadMissions() {
    setMissions(loadMissions());
  }

  const activeMissions = missions.filter((m) => m.status !== "archived");
  const archivedMissions = missions.filter((m) => m.status === "archived");
  const linkedReportCount = missions.reduce((total, mission) => total + getReportsForMission(mission.id).length, 0);
  const linkedAssetCount = loadAssets().filter((asset) => asset.source_mission).length;

  function handleCreate() {
    if (!newTitle.trim()) return;
    saveMission({ title: newTitle.trim(), description: newDescription.trim(), status: "active" });
    setNewTitle("");
    setNewDescription("");
    setShowCreateForm(false);
    reloadMissions();
  }

  function handleStatusChange(id: string, status: MissionStatus) {
    updateMission(id, { status });
    reloadMissions();
  }

  function handleArchive(id: string) {
    archiveMission(id);
    if (currentMissionId === id) {
      onSelectMission(null);
    }
    reloadMissions();
  }

  function handleDelete(id: string) {
    deleteMission(id);
    if (currentMissionId === id) {
      onSelectMission(null);
    }
    reloadMissions();
  }

  function handleSelect(id: string) {
    onSelectMission(currentMissionId === id ? null : id);
  }

  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Mission Workspace</p>
          <h3 className="mt-1 text-sm font-semibold text-ink">Mission 管理</h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">用 Mission 组织报告、复盘状态和后续资产沉淀。</p>
        </div>
        {!showCreateForm && (
          <button
            className="shrink-0 rounded border border-blue/30 px-3 py-1 text-xs font-medium text-blue transition hover:bg-blue/10"
            onClick={() => setShowCreateForm(true)}
            type="button"
          >
            创建 Mission
          </button>
        )}
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5 text-center">
          <p className="text-sm font-semibold text-ink">{activeMissions.length}</p>
          <p className="text-[10px] text-ink-muted">active</p>
        </div>
        <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5 text-center">
          <p className="text-sm font-semibold text-ink">{linkedReportCount}</p>
          <p className="text-[10px] text-ink-muted">reports</p>
        </div>
        <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5 text-center">
          <p className="text-sm font-semibold text-ink">{linkedAssetCount}</p>
          <p className="text-[10px] text-ink-muted">assets</p>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-3 space-y-2 rounded-lg border border-blue/20 bg-surface-1 p-3">
          <div>
            <label className="text-xs font-medium text-ink-muted">任务名称</label>
            <input
              className="mt-1 w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none focus:border-blue"
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：技术选型决策"
              value={newTitle}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">任务描述</label>
            <textarea
              className="mt-1 w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none focus:border-blue"
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="可选：描述这个任务的目标和范围"
              rows={2}
              value={newDescription}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-blue px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue/90 disabled:opacity-50"
              disabled={!newTitle.trim()}
              onClick={handleCreate}
              type="button"
            >
              创建
            </button>
            <button
              className="rounded border border-line px-3 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2"
              onClick={() => { setShowCreateForm(false); setNewTitle(""); setNewDescription(""); }}
              type="button"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {activeMissions.length > 0 && (
        <div className="space-y-2">
          {activeMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              isCurrent={currentMissionId === mission.id}
              isExpanded={expandedId === mission.id}
              onSelect={() => handleSelect(mission.id)}
              onExpand={() => setExpandedId(expandedId === mission.id ? null : mission.id)}
              onStatusChange={handleStatusChange}
              onArchive={() => handleArchive(mission.id)}
              onDelete={() => handleDelete(mission.id)}
            />
          ))}
        </div>
      )}

      {archivedMissions.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold text-ink-muted/70">已归档</h4>
          <div className="space-y-2">
            {archivedMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                isCurrent={false}
                isExpanded={expandedId === mission.id}
                onSelect={() => {}}
                onExpand={() => setExpandedId(expandedId === mission.id ? null : mission.id)}
                onStatusChange={() => {}}
                onArchive={() => {}}
                onDelete={() => handleDelete(mission.id)}
              />
            ))}
          </div>
        </div>
      )}

      {missions.length === 0 && !showCreateForm && (
        <p className="text-xs text-ink-muted/70">暂无 Mission。创建一个任务来组织分析报告、复盘状态和认知资产。</p>
      )}

      {currentMissionId && (
        <div className="mt-3 rounded border border-blue/20 bg-blue/5 px-3 py-2">
          <p className="text-xs text-blue">
            当前 Mission：{missions.find((m) => m.id === currentMissionId)?.title ?? "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-ink-muted/70">新分析报告将归属到此 Mission。</p>
        </div>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  isCurrent,
  isExpanded,
  onSelect,
  onExpand,
  onStatusChange,
  onArchive,
  onDelete,
}: {
  mission: Mission;
  isCurrent: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onStatusChange: (id: string, status: MissionStatus) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const reports = getReportsForMission(mission.id);
  const assets = loadAssets().filter((a) => a.source_mission === mission.id);
  const historyEntries = loadHistory().filter((h) =>
    reports.some((r) => r.run_id === h.run_id)
  );

  const nextStatusMap: Partial<Record<MissionStatus, MissionStatus>> = {
    active: "reviewed",
    reviewed: "asset_generated",
  };
  const nextStatus = nextStatusMap[mission.status];

  return (
    <div className={`rounded border px-3 py-2 transition ${
      isCurrent
        ? "border-blue bg-blue/5"
        : mission.status === "archived"
          ? "border-line bg-surface-1/60 opacity-60"
          : "border-line bg-surface-1"
    }`}>
      <div className="flex items-center gap-2">
        <button
          className="flex-1 text-left text-xs font-medium text-ink"
          onClick={onExpand}
          type="button"
        >
          {mission.title}
        </button>
        <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusColors[mission.status]}`}>
          {statusLabels[mission.status]}
        </span>
        {mission.status !== "archived" && (
          <button
            className={`rounded border px-2 py-0.5 text-[10px] font-medium transition ${
              isCurrent
                ? "border-blue bg-blue text-white"
                : "border-line text-ink-muted hover:bg-surface-2"
            }`}
            onClick={onSelect}
            type="button"
          >
            {isCurrent ? "当前" : "选择"}
          </button>
        )}
      </div>

      {mission.description && (
        <p className="mt-1 text-[10px] text-ink-muted">{mission.description}</p>
      )}

      <div className="mt-1 flex items-center gap-3 text-[10px] text-ink-muted/70">
        <span>{reports.length} 份报告</span>
        <span>{assets.length} 项资产</span>
        <span>{new Date(mission.updatedAt).toLocaleDateString()}</span>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          {historyEntries.length > 0 && (
            <div>
              <h5 className="mb-1 text-[10px] font-semibold text-ink-muted">关联报告</h5>
              <div className="space-y-1">
                {historyEntries.map((h) => (
                  <div key={h.run_id} className="rounded bg-surface-1 px-2 py-1 text-[10px] text-ink-muted">
                    {h.input_snapshot.originalGoal
                      ? `${h.input_snapshot.originalGoal.slice(0, 60)}${h.input_snapshot.originalGoal.length > 60 ? "..." : ""}`
                      : h.run_id.slice(0, 16)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {assets.length > 0 && (
            <div>
              <h5 className="mb-1 text-[10px] font-semibold text-ink-muted">关联资产</h5>
              <div className="space-y-1">
                {assets.map((a) => (
                  <div key={a.asset_id} className="rounded bg-surface-1 px-2 py-1 text-[10px] text-ink-muted">
                    {a.title || a.asset_type}
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyEntries.length === 0 && assets.length === 0 && (
            <p className="text-[10px] text-ink-muted/50">暂无关联的报告和资产。</p>
          )}

          <div className="flex items-center gap-2">
            {nextStatus && (
              <button
                className="rounded border border-blue/30 px-2 py-0.5 text-[10px] font-medium text-blue transition hover:bg-blue/10"
                onClick={() => onStatusChange(mission.id, nextStatus)}
                type="button"
              >
                标记为{statusLabels[nextStatus]}
              </button>
            )}
            {mission.status !== "archived" && (
              <button
                className="rounded border border-amber/30 px-2 py-0.5 text-[10px] font-medium text-amber transition hover:bg-amber/10"
                onClick={onArchive}
                type="button"
              >
                归档
              </button>
            )}
            <button
              className="rounded border border-amber/30 px-2 py-0.5 text-[10px] font-medium text-amber transition hover:bg-amber/10"
              onClick={onDelete}
              type="button"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
