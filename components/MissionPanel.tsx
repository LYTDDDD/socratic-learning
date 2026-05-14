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
  active: "bg-moss/10 text-moss border-moss/30",
  reviewed: "bg-blue-100 text-blue-700 border-blue-200",
  asset_generated: "bg-purple-100 text-purple-700 border-purple-200",
  archived: "bg-ink/5 text-ink/40 border-line",
};

type MissionPanelProps = {
  refreshKey: number;
  currentMissionId: string | null;
  onSelectMission: (missionId: string | null) => void;
};

export function MissionPanel({ refreshKey, currentMissionId, onSelectMission }: MissionPanelProps) {
  const [missions, setMissions] = useState<Mission[]>(() => loadMissions());
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
    <div className="rounded-lg border border-line bg-paper/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Mission 管理</h3>
        {!showCreateForm && (
          <button
            className="rounded border border-moss/30 px-3 py-1 text-xs font-medium text-moss transition hover:bg-moss/10"
            onClick={() => setShowCreateForm(true)}
            type="button"
          >
            创建 Mission
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="mb-3 space-y-2 rounded-lg border border-moss/20 bg-white p-3">
          <div>
            <label className="text-xs font-medium text-ink/60">任务名称</label>
            <input
              className="mt-1 w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none focus:border-moss"
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：技术选型决策"
              value={newTitle}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">任务描述</label>
            <textarea
              className="mt-1 w-full rounded border border-line px-2 py-1 text-xs text-ink outline-none focus:border-moss"
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="可选：描述这个任务的目标和范围"
              rows={2}
              value={newDescription}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-moss px-3 py-1 text-xs font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
              disabled={!newTitle.trim()}
              onClick={handleCreate}
              type="button"
            >
              创建
            </button>
            <button
              className="rounded border border-line px-3 py-1 text-xs font-medium text-ink/60 transition hover:bg-paper"
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
          <h4 className="mb-2 text-xs font-semibold text-ink/40">已归档</h4>
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
        <p className="text-xs text-ink/40">暂无 Mission。创建一个任务来组织你的分析报告和认知资产。</p>
      )}

      {currentMissionId && (
        <div className="mt-3 rounded border border-moss/20 bg-moss/5 px-3 py-2">
          <p className="text-xs text-moss">
            当前 Mission：{missions.find((m) => m.id === currentMissionId)?.title ?? "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-ink/40">新分析报告将归属到此 Mission。</p>
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
        ? "border-moss bg-moss/5"
        : mission.status === "archived"
          ? "border-line bg-paper/40 opacity-60"
          : "border-line bg-white"
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
                ? "border-moss bg-moss text-white"
                : "border-line text-ink/60 hover:bg-paper"
            }`}
            onClick={onSelect}
            type="button"
          >
            {isCurrent ? "当前" : "选择"}
          </button>
        )}
      </div>

      {mission.description && (
        <p className="mt-1 text-[10px] text-ink/50">{mission.description}</p>
      )}

      <div className="mt-1 flex items-center gap-3 text-[10px] text-ink/40">
        <span>{reports.length} 份报告</span>
        <span>{assets.length} 项资产</span>
        <span>{new Date(mission.updatedAt).toLocaleDateString()}</span>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          {historyEntries.length > 0 && (
            <div>
              <h5 className="mb-1 text-[10px] font-semibold text-ink/60">关联报告</h5>
              <div className="space-y-1">
                {historyEntries.map((h) => (
                  <div key={h.run_id} className="rounded bg-paper/60 px-2 py-1 text-[10px] text-ink/60">
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
              <h5 className="mb-1 text-[10px] font-semibold text-ink/60">关联资产</h5>
              <div className="space-y-1">
                {assets.map((a) => (
                  <div key={a.asset_id} className="rounded bg-paper/60 px-2 py-1 text-[10px] text-ink/60">
                    {a.title || a.asset_type}
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyEntries.length === 0 && assets.length === 0 && (
            <p className="text-[10px] text-ink/30">暂无关联的报告和资产。</p>
          )}

          <div className="flex items-center gap-2">
            {nextStatus && (
              <button
                className="rounded border border-moss/30 px-2 py-0.5 text-[10px] font-medium text-moss transition hover:bg-moss/10"
                onClick={() => onStatusChange(mission.id, nextStatus)}
                type="button"
              >
                标记为{statusLabels[nextStatus]}
              </button>
            )}
            {mission.status !== "archived" && (
              <button
                className="rounded border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-700 transition hover:bg-amber-50"
                onClick={onArchive}
                type="button"
              >
                归档
              </button>
            )}
            <button
              className="rounded border border-rust/30 px-2 py-0.5 text-[10px] font-medium text-rust transition hover:bg-rust/10"
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
