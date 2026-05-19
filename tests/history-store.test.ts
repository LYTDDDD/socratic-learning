import { describe, expect, it, beforeEach, vi, beforeAll } from "vitest";
import {
  saveToHistory,
  loadHistory,
  updateHistoryStatus,
  appendRunLogUserAction,
  deleteFromHistory,
  clearHistory,
} from "../lib/history-store";
import type { HistoryEntry } from "../lib/history-store";
import type { AnalyzeResponse } from "../lib/analyze-types";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
  get length(): number {
    return Object.keys(this.store).length;
  }
  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

function makeResponse(overrides?: Partial<AnalyzeResponse>): AnalyzeResponse {
  return {
    markdown: "# test",
    json: { mission_review: {} },
    raw: null,
    parseStatus: "success",
    error: null,
    runLog: {
      run_id: "run_test_123",
      created_at: new Date().toISOString(),
      input_snapshot: { originalGoal: "test goal", conversation: "test conversation" },
      prompt_version: "v0.1",
      model_name: "test-model",
      request_status: "success",
      parse_status: "success",
      duration_ms: 100,
      error_message: null,
    },
    ...overrides,
  };
}

function makeEntry(overrides?: Partial<HistoryEntry>): HistoryEntry {
  return {
    run_id: "run_test_123",
    created_at: new Date().toISOString(),
    input_snapshot: { originalGoal: "test goal", conversation: "test conversation" },
    analyzeResponse: makeResponse(),
    status: "draft",
    ...overrides,
  };
}

describe("history-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadHistory", () => {
    it("returns empty array when localStorage is empty", () => {
      expect(loadHistory()).toEqual([]);
    });
  });

  describe("saveToHistory + loadHistory round-trip", () => {
    it("saves and loads an entry correctly", () => {
      const entry = makeEntry();
      saveToHistory(entry);
      const loaded = loadHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].run_id).toBe(entry.run_id);
      expect(loaded[0].status).toBe("draft");
      expect(loaded[0].input_snapshot.originalGoal).toBe("test goal");
      expect(loaded[0].analyzeResponse.markdown).toBe("# test");
    });
  });

  describe("saveToHistory default status", () => {
    it("defaults status to draft when not provided", () => {
      const entry = makeEntry({ status: undefined as unknown as "draft" });
      saveToHistory(entry);
      const loaded = loadHistory();
      expect(loaded[0].status).toBe("draft");
    });
  });

  describe("saveToHistory dedup by run_id", () => {
    it("replaces entry with same run_id", () => {
      const entry1 = makeEntry({ run_id: "run_dup" });
      saveToHistory(entry1);
      const entry2 = makeEntry({
        run_id: "run_dup",
        analyzeResponse: makeResponse({ markdown: "# updated" }),
      });
      saveToHistory(entry2);
      const loaded = loadHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].analyzeResponse.markdown).toBe("# updated");
    });
  });

  describe("saveToHistory max 50 entries", () => {
    it("keeps at most 50 entries", () => {
      for (let i = 0; i < 55; i++) {
        saveToHistory(makeEntry({ run_id: `run_${i}` }));
      }
      const loaded = loadHistory();
      expect(loaded).toHaveLength(50);
      // Most recent entries come first
      expect(loaded[0].run_id).toBe("run_54");
      expect(loaded[49].run_id).toBe("run_5");
    });
  });

  describe("updateHistoryStatus", () => {
    it("updates status correctly", () => {
      const entry = makeEntry({ run_id: "run_status_test" });
      saveToHistory(entry);
      updateHistoryStatus("run_status_test", "reviewed");
      const loaded = loadHistory();
      expect(loaded[0].status).toBe("reviewed");
    });

    it("does not throw for non-existent run_id", () => {
      const entry = makeEntry({ run_id: "run_exists" });
      saveToHistory(entry);
      expect(() => updateHistoryStatus("run_nonexistent", "reviewed")).not.toThrow();
      // Original entry unchanged
      const loaded = loadHistory();
      expect(loaded[0].status).toBe("draft");
    });
  });

  describe("appendRunLogUserAction", () => {
    it("appends a user action to the matching run log", () => {
      saveToHistory(makeEntry({ run_id: "run_action_test" }));

      const action = appendRunLogUserAction("run_action_test", "copy_json");
      const loaded = loadHistory();

      expect(action).not.toBeNull();
      expect(action?.type).toBe("copy_json");
      expect(action?.at).toBeTruthy();
      expect(loaded[0].analyzeResponse.runLog?.user_actions).toEqual([action]);
    });

    it("keeps at most 50 user actions per run log", () => {
      saveToHistory(makeEntry({ run_id: "run_action_cap" }));

      for (let i = 0; i < 55; i++) {
        appendRunLogUserAction("run_action_cap", i === 54 ? "download_raw" : "copy_report");
      }

      const actions = loadHistory()[0].analyzeResponse.runLog?.user_actions ?? [];
      expect(actions).toHaveLength(50);
      expect(actions[49].type).toBe("download_raw");
    });

    it("returns null for a missing run id", () => {
      saveToHistory(makeEntry({ run_id: "run_exists" }));

      expect(appendRunLogUserAction("run_missing", "copy_report")).toBeNull();
      expect(loadHistory()[0].analyzeResponse.runLog?.user_actions).toBeUndefined();
    });
  });

  describe("deleteFromHistory", () => {
    it("deletes entry by run_id", () => {
      saveToHistory(makeEntry({ run_id: "run_del_1" }));
      saveToHistory(makeEntry({ run_id: "run_del_2" }));
      deleteFromHistory("run_del_1");
      const loaded = loadHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].run_id).toBe("run_del_2");
    });
  });

  describe("clearHistory", () => {
    it("clears all entries", () => {
      saveToHistory(makeEntry({ run_id: "run_a" }));
      saveToHistory(makeEntry({ run_id: "run_b" }));
      clearHistory();
      expect(loadHistory()).toEqual([]);
    });
  });

  describe("loadHistory legacy data without status field", () => {
    it("fills missing status with draft", () => {
      const entryWithoutStatus = {
        run_id: "run_legacy",
        created_at: new Date().toISOString(),
        input_snapshot: { originalGoal: "test", conversation: "test" },
        analyzeResponse: makeResponse(),
      };
      // Directly write to localStorage without status field
      const raw = JSON.stringify([entryWithoutStatus]);
      localStorage.setItem("socratic-analysis-history", raw);
      const loaded = loadHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].status).toBe("draft");
    });
  });

  describe("localStorage error handling", () => {
    it("loadHistory returns empty array when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(loadHistory()).toEqual([]);
      vi.restoreAllMocks();
    });

    it("saveToHistory does not throw when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(() => saveToHistory(makeEntry())).not.toThrow();
      vi.restoreAllMocks();
    });
  });
});
