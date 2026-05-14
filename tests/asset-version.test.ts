import { describe, expect, it, beforeEach, vi, beforeAll } from "vitest";
import { minorEditAsset, createAssetVersion, loadAssets, saveAsset, updateAsset } from "../lib/asset-store";
import type { CognitiveAsset, AssetVersion } from "../lib/extract-asset";

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

beforeEach(() => {
  localStorage.clear();
});

const EMPTY_CONNECTION_LAYER = {
  related_concepts: [],
  related_assets: [],
  mental_models: [],
  prior_experience: [],
  opposite_cases: [],
  application_scenarios: [],
  open_questions: [],
};

function makeAsset(overrides?: Partial<CognitiveAsset>): CognitiveAsset {
  return {
    asset_id: "asset_1",
    created_at: "2026-01-01T00:00:00.000Z",
    source_run_id: "run_1",
    status: "confirmed",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "约束驱动选型",
    ai_generated_summary: "",
    core_insight: "基于团队规模做选型",
    my_understanding: "",
    problem_it_solves: "",
    original_judgment: "微服务更好",
    revised_judgment: "模块化单体更适合",
    my_judgment: "",
    transferable_value: "可迁移到其他决策",
    review_questions: [],
    source_mission: "",
    confidence: 0.8,
    special_fields: {},
    full_package: {},
    connection_questions: [],
    application_questions: [],
    user_built_connections: { ...EMPTY_CONNECTION_LAYER },
    ai_suggested_connections: { ...EMPTY_CONNECTION_LAYER },
    connection_layer: { ...EMPTY_CONNECTION_LAYER },
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    current_version_id: "ver_1",
    versions: [
      {
        id: "ver_1",
        assetId: "asset_1",
        versionNumber: 1,
        title: "约束驱动选型",
        coreInsight: "基于团队规模做选型",
        originalJudgment: "微服务更好",
        revisedJudgment: "模块化单体更适合",
        myUnderstanding: "",
        transferableValue: "可迁移到其他决策",
        changeReason: "初始版本",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("minorEditAsset", () => {
  it("updates asset fields without creating a new version", () => {
    const asset = makeAsset();
    saveAsset(asset);

    const updated = minorEditAsset(asset, { title: "约束驱动选型（修订）" });

    expect(updated.title).toBe("约束驱动选型（修订）");
    expect(updated.versions).toHaveLength(1);
    expect(updated.current_version_id).toBe("ver_1");
  });

  it("persists the minor edit to localStorage", () => {
    const asset = makeAsset();
    saveAsset(asset);

    minorEditAsset(asset, { title: "updated title" });

    const loaded = loadAssets();
    expect(loaded[0].title).toBe("updated title");
    expect(loaded[0].versions).toHaveLength(1);
  });

  it("syncs current version snapshot on minor edit", () => {
    const asset = makeAsset();
    saveAsset(asset);

    minorEditAsset(asset, { title: "新标题", core_insight: "新洞察" });

    const loaded = loadAssets();
    expect(loaded[0].versions[0].title).toBe("新标题");
    expect(loaded[0].versions[0].coreInsight).toBe("新洞察");
  });

  it("does not add a version entry", () => {
    const asset = makeAsset();
    saveAsset(asset);

    minorEditAsset(asset, { core_insight: "updated insight" });

    const loaded = loadAssets();
    expect(loaded[0].versions).toHaveLength(1);
  });
});

describe("createAssetVersion", () => {
  it("creates a new version with incremented version number", () => {
    const asset = makeAsset();
    saveAsset(asset);

    const updated = createAssetVersion(asset, { core_insight: "updated insight" }, "判断变化");

    expect(updated.versions).toHaveLength(2);
    expect(updated.versions[1].versionNumber).toBe(2);
    expect(updated.versions[1].changeReason).toBe("判断变化");
    expect(updated.versions[1].coreInsight).toBe("updated insight");
  });

  it("updates the current_version_id to the new version", () => {
    const asset = makeAsset();
    saveAsset(asset);

    const updated = createAssetVersion(asset, { title: "new title" }, "标题变化");

    expect(updated.current_version_id).not.toBe("ver_1");
    expect(updated.current_version_id).toBe(updated.versions[1].id);
  });

  it("preserves old version data", () => {
    const asset = makeAsset();
    saveAsset(asset);

    createAssetVersion(asset, { core_insight: "new insight" }, "insight changed");

    const loaded = loadAssets();
    expect(loaded[0].versions[0].coreInsight).toBe("基于团队规模做选型");
    expect(loaded[0].versions[1].coreInsight).toBe("new insight");
  });

  it("persists the new version to localStorage", () => {
    const asset = makeAsset();
    saveAsset(asset);

    createAssetVersion(asset, { revised_judgment: "new judgment" }, "判断修正");

    const loaded = loadAssets();
    expect(loaded[0].versions).toHaveLength(2);
    expect(loaded[0].revised_judgment).toBe("new judgment");
  });

  it("supports multiple version increments", () => {
    const asset = makeAsset();
    saveAsset(asset);

    const v2 = createAssetVersion(asset, { title: "v2" }, "change 1");
    const v3 = createAssetVersion(v2, { title: "v3" }, "change 2");

    expect(v3.versions).toHaveLength(3);
    expect(v3.versions[1].versionNumber).toBe(2);
    expect(v3.versions[2].versionNumber).toBe(3);
  });

  it("uses current asset values when updates not provided", () => {
    const asset = makeAsset();
    saveAsset(asset);

    const updated = createAssetVersion(asset, {}, "no field changes");

    expect(updated.versions[1].title).toBe(asset.title);
    expect(updated.versions[1].coreInsight).toBe(asset.core_insight);
  });
});
