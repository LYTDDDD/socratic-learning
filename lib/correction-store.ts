export type Correction = {
  id: string;
  reportId: string;
  correctionType: "minor_correction" | "strong_correction";
  target: "intent" | "depth_score" | "asset_type" | "misconception" | "update_proposal";
  originalValue: unknown;
  correctedValue: unknown;
  reason: string;
  createdAt: string;
};

const STORAGE_KEY = "socratic-corrections";

function generateCorrectionId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadCorrections(reportId?: string): Correction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const all = parsed.filter((item): item is Correction => {
      if (!item || typeof item !== "object") return false;
      const c = item as Partial<Correction>;
      return (
        typeof c.id === "string" &&
        typeof c.reportId === "string" &&
        typeof c.correctionType === "string" &&
        typeof c.target === "string" &&
        typeof c.reason === "string" &&
        typeof c.createdAt === "string"
      );
    });
    if (reportId) {
      return all.filter((c) => c.reportId === reportId);
    }
    return all;
  } catch {
    return [];
  }
}

export function saveCorrection(correction: Omit<Correction, "id" | "createdAt">): Correction | null {
  try {
    const entry: Correction = {
      ...correction,
      id: generateCorrectionId(),
      createdAt: new Date().toISOString(),
    };
    const all = loadCorrections();
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return entry;
  } catch {
    return null;
  }
}

export function deleteCorrection(id: string): void {
  try {
    const all = loadCorrections();
    const filtered = all.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}
