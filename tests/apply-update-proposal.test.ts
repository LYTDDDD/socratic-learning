import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { loadAssets, saveAsset } from "../lib/asset-store";
import { applyAssetUpdateProposal, findAssetById } from "../lib/apply-update-proposal";
import type { CognitiveAsset } from "../lib/extract-asset";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  get length(): number { return Object.keys(this.store).length; }
  key(index: number): string | null { const keys = Object.keys(this.store); return keys[index] ?? null; }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

function makeAsset(overrides: Partial<CognitiveAsset> = {}): CognitiveAsset {
  return {
    asset_id: "asset_test_001",
    title: "测试资产",
    asset_type: "MethodCard",
    maturity: "Reference",
    status: "confirmed",
    core_insight: "原始核心洞察",
    original_judgment: "原始判断",
    revised_judgment: "修正判断",
    my_understanding: "原始理解",
    transferable_value: "原始迁移价值",
    source_run_id: "run_001",
    created_at: new Date().toISOString(),
    current_version_id: "v1",
    versions: [
      {
        id: "v1",
        assetId: "asset_test_001",
        versionNumber: 1,
        title: "测试资产",
        coreInsight: "原始核心洞察",
        originalJudgment: "原始判断",
        revisedJudgment: "修正判断",
        myUnderstanding: "原始理解",
        transferableValue: "原始迁移价值",
        changeReason: "初始创建",
        createdAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  } as CognitiveAsset;
}

beforeEach(() => {
  mockLocalStorage.clear();
});

describe("applyAssetUpdateProposal", () => {
  it("returns error when asset id is missing", () => {
    const result = applyAssetUpdateProposal({
      suggested_action: "create_new_version",
      related_asset_id: "",
      related_asset_title: "",
      reason: "test",
      evidence: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("缺少关联资产 ID");
    }
  });

  it("returns error for unsupported suggested_action", () => {
    saveAsset(makeAsset());
    const result = applyAssetUpdateProposal({
      suggested_action: "minor_edit_only",
      related_asset_id: "asset_test_001",
      related_asset_title: "测试资产",
      reason: "test",
      evidence: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("不支持的动作类型");
    }
  });

  it("returns error for update_maturity action", () => {
    saveAsset(makeAsset());
    const result = applyAssetUpdateProposal({
      suggested_action: "update_maturity",
      related_asset_id: "asset_test_001",
      related_asset_title: "测试资产",
      reason: "test",
      evidence: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("不支持的动作类型");
    }
  });

  it("returns error when target asset not found", () => {
    const result = applyAssetUpdateProposal({
      suggested_action: "create_new_version",
      related_asset_id: "nonexistent",
      related_asset_title: "不存在的资产",
      reason: "test",
      evidence: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("未找到关联资产");
    }
  });

  it("returns error when no suggested_changes fields", () => {
    saveAsset(makeAsset());
    const result = applyAssetUpdateProposal({
      suggested_action: "create_new_version",
      related_asset_id: "asset_test_001",
      related_asset_title: "测试资产",
      reason: "test",
      evidence: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("没有可应用的变更字段");
    }
  });

  it("creates new version for create_new_version action", () => {
    saveAsset(makeAsset());

    const result = applyAssetUpdateProposal({
      suggested_action: "create_new_version",
      related_asset_id: "asset_test_001",
      related_asset_title: "测试资产",
      reason: "补充迁移维度",
      evidence: ["深度评估不足"],
      suggested_changes: {
        core_insight: "更新后的核心洞察",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.asset.versions.length).toBe(2);
      expect(result.asset.current_version_id).not.toBe("v1");
      expect(result.asset.core_insight).toBe("更新后的核心洞察");
      const oldVersion = result.asset.versions.find((v) => v.id === "v1");
      expect(oldVersion).toBeDefined();
      expect(oldVersion!.coreInsight).toBe("原始核心洞察");
    }
  });

  it("applies minor_edit by creating new version, not overwriting old", () => {
    saveAsset(makeAsset());

    const result = applyAssetUpdateProposal({
      suggested_action: "minor_edit",
      related_asset_id: "asset_test_001",
      related_asset_title: "测试资产",
      reason: "修正措辞",
      evidence: [],
      suggested_changes: {
        core_insight: "修正后的核心洞察",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.asset.versions.length).toBe(2);
      expect(result.asset.current_version_id).not.toBe("v1");
      expect(result.asset.core_insight).toBe("修正后的核心洞察");
      const oldVersion = result.asset.versions.find((v) => v.id === "v1");
      expect(oldVersion).toBeDefined();
      expect(oldVersion!.coreInsight).toBe("原始核心洞察");
    }
  });
});

describe("findAssetById", () => {
  it("returns undefined for empty id", () => {
    expect(findAssetById("")).toBeUndefined();
    expect(findAssetById("  ")).toBeUndefined();
  });

  it("returns undefined when asset not found", () => {
    expect(findAssetById("nonexistent")).toBeUndefined();
  });

  it("returns asset when found", () => {
    saveAsset(makeAsset());
    const found = findAssetById("asset_test_001");
    expect(found).toBeDefined();
    expect(found!.title).toBe("测试资产");
  });
});
