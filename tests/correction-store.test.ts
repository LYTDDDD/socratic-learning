import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { loadCorrections, saveCorrection, deleteCorrection } from "../lib/correction-store";
import type { Correction } from "../lib/correction-store";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  get length(): number { return Object.keys(this.store).length; }
  key(index: number): string | null { return Object.keys(this.store)[index] ?? null; }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

beforeEach(() => {
  localStorage.clear();
});

describe("loadCorrections", () => {
  it("returns empty array when no corrections stored", () => {
    expect(loadCorrections()).toEqual([]);
  });

  it("returns all corrections when no reportId filter", () => {
    saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "asset_type", originalValue: "A", correctedValue: "B", reason: "test" });
    saveCorrection({ reportId: "r2", correctionType: "strong_correction", target: "depth_score", originalValue: 3, correctedValue: 5, reason: "test2" });
    expect(loadCorrections()).toHaveLength(2);
  });

  it("filters corrections by reportId", () => {
    saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "asset_type", originalValue: "A", correctedValue: "B", reason: "test" });
    saveCorrection({ reportId: "r2", correctionType: "strong_correction", target: "depth_score", originalValue: 3, correctedValue: 5, reason: "test2" });
    expect(loadCorrections("r1")).toHaveLength(1);
    expect(loadCorrections("r1")[0].reportId).toBe("r1");
  });

  it("returns empty array when stored value is not an array", () => {
    localStorage.setItem("socratic-corrections", JSON.stringify({ reportId: "r1" }));

    expect(loadCorrections()).toEqual([]);
  });

  it("filters malformed correction entries", () => {
    localStorage.setItem(
      "socratic-corrections",
      JSON.stringify([
        { id: "bad" },
        {
          id: "corr_valid",
          reportId: "r1",
          correctionType: "minor_correction",
          target: "asset_type",
          originalValue: "A",
          correctedValue: "B",
          reason: "test",
          createdAt: "2026-05-14T00:00:00.000Z",
        },
      ]),
    );

    expect(loadCorrections()).toHaveLength(1);
    expect(loadCorrections()[0].id).toBe("corr_valid");
  });
});

describe("saveCorrection", () => {
  it("generates id and createdAt", () => {
    const c = saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "intent", originalValue: null, correctedValue: null, reason: "test" });
    expect(c).not.toBeNull();
    expect(c!.id).toMatch(/^corr_/);
    expect(c!.createdAt).toBeTruthy();
  });

  it("persists to localStorage", () => {
    saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "asset_type", originalValue: "X", correctedValue: "Y", reason: "persist test" });
    const loaded = loadCorrections("r1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].reason).toBe("persist test");
  });

  it("preserves all fields", () => {
    saveCorrection({ reportId: "r1", correctionType: "strong_correction", target: "misconception", originalValue: "误区", correctedValue: "探索", reason: "不是误区" });
    const loaded = loadCorrections("r1");
    expect(loaded[0].correctionType).toBe("strong_correction");
    expect(loaded[0].target).toBe("misconception");
    expect(loaded[0].originalValue).toBe("误区");
    expect(loaded[0].correctedValue).toBe("探索");
  });
});

describe("deleteCorrection", () => {
  it("removes a correction by id", () => {
    const c1 = saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "asset_type", originalValue: "A", correctedValue: "B", reason: "test" });
    expect(c1).not.toBeNull();
    saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "intent", originalValue: null, correctedValue: null, reason: "test2" });
    expect(loadCorrections()).toHaveLength(2);
    deleteCorrection(c1!.id);
    expect(loadCorrections()).toHaveLength(1);
  });

  it("does nothing for non-existent id", () => {
    saveCorrection({ reportId: "r1", correctionType: "minor_correction", target: "asset_type", originalValue: "A", correctedValue: "B", reason: "test" });
    deleteCorrection("nonexistent");
    expect(loadCorrections()).toHaveLength(1);
  });
});
