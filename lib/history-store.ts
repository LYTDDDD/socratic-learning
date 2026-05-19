import type { AnalyzeResponse } from "./analyze-types";
import type { RunLogUserAction, RunLogUserActionType } from "./run-log";

const STORAGE_KEY = "socratic-analysis-history";
const MAX_ENTRIES = 50;
const MAX_USER_ACTIONS = 50;

export type HistoryStatus = "draft" | "reviewed" | "discarded";

export type HistoryEntry = {
  run_id: string;
  created_at: string;
  input_snapshot: { originalGoal: string; conversation: string };
  analyzeResponse: AnalyzeResponse;
  status: HistoryStatus;
};

export function saveToHistory(entry: HistoryEntry): void {
  try {
    const history = loadHistory();
    const withStatus: HistoryEntry = { ...entry, status: entry.status ?? "draft" };
    const filtered = history.filter((h) => h.run_id !== withStatus.run_id);
    filtered.unshift(withStatus);
    const trimmed = filtered.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: HistoryEntry) => ({
      ...e,
      status: e.status ?? "draft",
    }));
  } catch {
    return [];
  }
}

export function deleteFromHistory(runId: string): void {
  try {
    const history = loadHistory();
    const filtered = history.filter((h) => h.run_id !== runId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function updateHistoryStatus(runId: string, status: HistoryStatus): void {
  try {
    const history = loadHistory();
    const updated = history.map((h) =>
      h.run_id === runId ? { ...h, status } : h
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function appendRunLogUserAction(runId: string, type: RunLogUserActionType): RunLogUserAction | null {
  try {
    const action: RunLogUserAction = { type, at: new Date().toISOString() };
    const history = loadHistory();
    let found = false;
    const updated = history.map((h) => {
      if (h.run_id !== runId || !h.analyzeResponse.runLog) return h;
      found = true;
      const userActions = [...(h.analyzeResponse.runLog.user_actions ?? []), action].slice(-MAX_USER_ACTIONS);
      return {
        ...h,
        analyzeResponse: {
          ...h.analyzeResponse,
          runLog: {
            ...h.analyzeResponse.runLog,
            user_actions: userActions,
          },
        },
      };
    });
    if (!found) return null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return action;
  } catch {
    return null;
  }
}
