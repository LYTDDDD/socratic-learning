export type MissionStatus = "active" | "reviewed" | "asset_generated" | "archived";

export type Mission = {
  id: string;
  title: string;
  description: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

const STORAGE_KEY = "socratic-missions";

function generateMissionId(): string {
  return `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadMissions(status?: MissionStatus): Mission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const all = parsed.filter((item): item is Mission => {
      if (!item || typeof item !== "object") return false;
      const m = item as Partial<Mission>;
      return (
        typeof m.id === "string" &&
        typeof m.title === "string" &&
        typeof m.status === "string" &&
        typeof m.createdAt === "string"
      );
    });
    if (status) {
      return all.filter((m) => m.status === status);
    }
    return all;
  } catch {
    return [];
  }
}

export function saveMission(mission: Omit<Mission, "id" | "createdAt" | "updatedAt" | "archivedAt">): Mission | null {
  try {
    const now = new Date().toISOString();
    const entry: Mission = {
      ...mission,
      id: generateMissionId(),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const all = loadMissions();
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return entry;
  } catch {
    return null;
  }
}

export function updateMission(id: string, updates: Partial<Pick<Mission, "title" | "description" | "status" | "archivedAt">>): Mission | null {
  try {
    const all = loadMissions();
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all[idx];
  } catch {
    return null;
  }
}

export function archiveMission(id: string): Mission | null {
  return updateMission(id, { status: "archived", archivedAt: new Date().toISOString() });
}

export function deleteMission(id: string): void {
  try {
    const all = loadMissions();
    const filtered = all.filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    const raw = localStorage.getItem("socratic-mission-reports");
    if (raw) {
      const links: { missionId: string; runId: string; createdAt: string }[] = JSON.parse(raw);
      const cleaned = links.filter((l) => l.missionId !== id);
      localStorage.setItem("socratic-mission-reports", JSON.stringify(cleaned));
    }
  } catch {}
}

export function getMissionById(id: string): Mission | null {
  const all = loadMissions();
  return all.find((m) => m.id === id) ?? null;
}

export function getReportsForMission(missionId: string): { run_id: string; created_at: string }[] {
  try {
    const raw = localStorage.getItem("socratic-mission-reports");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: { missionId: string }) => item.missionId === missionId)
      .map((item: { runId: string; createdAt: string }) => ({
        run_id: item.runId,
        created_at: item.createdAt,
      }));
  } catch {
    return [];
  }
}

export function assignReportToMission(missionId: string, runId: string): void {
  try {
    const raw = localStorage.getItem("socratic-mission-reports");
    const links: { missionId: string; runId: string; createdAt: string }[] = raw
      ? JSON.parse(raw)
      : [];
    const exists = links.some((l) => l.missionId === missionId && l.runId === runId);
    if (exists) return;
    links.push({ missionId, runId, createdAt: new Date().toISOString() });
    localStorage.setItem("socratic-mission-reports", JSON.stringify(links));
  } catch {}
}

export function unassignReportFromMission(missionId: string, runId: string): void {
  try {
    const raw = localStorage.getItem("socratic-mission-reports");
    if (!raw) return;
    const links: { missionId: string; runId: string; createdAt: string }[] = JSON.parse(raw);
    const filtered = links.filter((l) => !(l.missionId === missionId && l.runId === runId));
    localStorage.setItem("socratic-mission-reports", JSON.stringify(filtered));
  } catch {}
}

export function getMissionForReport(runId: string): Mission | null {
  try {
    const raw = localStorage.getItem("socratic-mission-reports");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const link = parsed.find((item: { runId: string }) => item.runId === runId);
    if (!link) return null;
    return getMissionById(link.missionId);
  } catch {
    return null;
  }
}

export function getAssetsForMission(missionId: string, allAssets: { source_mission: string }[]): { source_mission: string }[] {
  return allAssets.filter((a) => a.source_mission === missionId);
}
