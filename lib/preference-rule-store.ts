export type PreferenceRule = {
  id: string;
  content: string;
  sourceCorrectionId: string | null;
  status: "draft" | "confirmed" | "disabled";
  createdAt: string;
  confirmedAt: string | null;
};

const STORAGE_KEY = "socratic-preference-rules";

function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPreferenceRules(status?: PreferenceRule["status"]): PreferenceRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const all = parsed.filter((item): item is PreferenceRule => {
      if (!item || typeof item !== "object") return false;
      const r = item as Partial<PreferenceRule>;
      return (
        typeof r.id === "string" &&
        typeof r.content === "string" &&
        typeof r.status === "string" &&
        typeof r.createdAt === "string"
      );
    });
    if (status) {
      return all.filter((r) => r.status === status);
    }
    return all;
  } catch {
    return [];
  }
}

export function savePreferenceRule(rule: Omit<PreferenceRule, "id" | "createdAt">): PreferenceRule | null {
  try {
    const entry: PreferenceRule = {
      ...rule,
      id: generateRuleId(),
      createdAt: new Date().toISOString(),
    };
    const all = loadPreferenceRules();
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return entry;
  } catch {
    return null;
  }
}

export function updatePreferenceRule(id: string, updates: Partial<Pick<PreferenceRule, "content" | "status" | "confirmedAt">>): PreferenceRule | null {
  try {
    const all = loadPreferenceRules();
    const idx = all.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all[idx];
  } catch {
    return null;
  }
}

export function confirmPreferenceRule(id: string): PreferenceRule | null {
  return updatePreferenceRule(id, { status: "confirmed", confirmedAt: new Date().toISOString() });
}

export function disablePreferenceRule(id: string): PreferenceRule | null {
  return updatePreferenceRule(id, { status: "disabled" });
}

export function enablePreferenceRule(id: string): PreferenceRule | null {
  return updatePreferenceRule(id, { status: "confirmed" });
}

export function deletePreferenceRule(id: string): void {
  try {
    const all = loadPreferenceRules();
    const filtered = all.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function getConfirmedRules(): PreferenceRule[] {
  return loadPreferenceRules("confirmed");
}
