import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import {
  loadPreferenceRules,
  savePreferenceRule,
  confirmPreferenceRule,
  disablePreferenceRule,
  enablePreferenceRule,
  deletePreferenceRule,
  getConfirmedRules,
} from "../lib/preference-rule-store";

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

describe("loadPreferenceRules", () => {
  it("returns empty array when no rules stored", () => {
    expect(loadPreferenceRules()).toEqual([]);
  });

  it("filters by status", () => {
    savePreferenceRule({ content: "rule 1", sourceCorrectionId: null, status: "draft", confirmedAt: null });
    savePreferenceRule({ content: "rule 2", sourceCorrectionId: null, status: "confirmed", confirmedAt: null });
    expect(loadPreferenceRules("draft")).toHaveLength(1);
    expect(loadPreferenceRules("confirmed")).toHaveLength(1);
    expect(loadPreferenceRules("disabled")).toHaveLength(0);
  });
});

describe("savePreferenceRule", () => {
  it("generates id and createdAt", () => {
    const rule = savePreferenceRule({ content: "test rule", sourceCorrectionId: null, status: "draft", confirmedAt: null });
    expect(rule).not.toBeNull();
    expect(rule!.id).toMatch(/^rule_/);
    expect(rule!.createdAt).toBeTruthy();
  });

  it("persists to localStorage", () => {
    savePreferenceRule({ content: "persist test", sourceCorrectionId: "corr_1", status: "draft", confirmedAt: null });
    const loaded = loadPreferenceRules();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe("persist test");
    expect(loaded[0].sourceCorrectionId).toBe("corr_1");
  });
});

describe("confirmPreferenceRule", () => {
  it("changes status to confirmed and sets confirmedAt", () => {
    const rule = savePreferenceRule({ content: "test", sourceCorrectionId: null, status: "draft", confirmedAt: null });
    const confirmed = confirmPreferenceRule(rule!.id);
    expect(confirmed).not.toBeNull();
    expect(confirmed!.status).toBe("confirmed");
    expect(confirmed!.confirmedAt).toBeTruthy();
  });

  it("returns null for non-existent id", () => {
    expect(confirmPreferenceRule("nonexistent")).toBeNull();
  });
});

describe("disablePreferenceRule", () => {
  it("changes status to disabled", () => {
    const rule = savePreferenceRule({ content: "test", sourceCorrectionId: null, status: "confirmed", confirmedAt: null });
    const disabled = disablePreferenceRule(rule!.id);
    expect(disabled!.status).toBe("disabled");
  });
});

describe("enablePreferenceRule", () => {
  it("changes status back to confirmed", () => {
    const rule = savePreferenceRule({ content: "test", sourceCorrectionId: null, status: "disabled", confirmedAt: null });
    const enabled = enablePreferenceRule(rule!.id);
    expect(enabled!.status).toBe("confirmed");
  });
});

describe("deletePreferenceRule", () => {
  it("removes a rule by id", () => {
    const rule = savePreferenceRule({ content: "test", sourceCorrectionId: null, status: "draft", confirmedAt: null });
    expect(loadPreferenceRules()).toHaveLength(1);
    deletePreferenceRule(rule!.id);
    expect(loadPreferenceRules()).toHaveLength(0);
  });
});

describe("getConfirmedRules", () => {
  it("returns only confirmed rules", () => {
    savePreferenceRule({ content: "draft rule", sourceCorrectionId: null, status: "draft", confirmedAt: null });
    savePreferenceRule({ content: "confirmed rule", sourceCorrectionId: null, status: "confirmed", confirmedAt: null });
    savePreferenceRule({ content: "disabled rule", sourceCorrectionId: null, status: "disabled", confirmedAt: null });
    expect(getConfirmedRules()).toHaveLength(1);
    expect(getConfirmedRules()[0].content).toBe("confirmed rule");
  });
});
