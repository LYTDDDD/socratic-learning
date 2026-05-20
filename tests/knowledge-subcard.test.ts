import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  archiveKnowledgeSubCard,
  createKnowledgeSubCard,
  KNOWLEDGE_SUBCARD_TEMPLATE,
  loadKnowledgeSubCards,
  saveKnowledgeSubCard,
  suggestSubCardDrafts,
} from "../lib/knowledge-subcard";
import type { CognitiveAsset } from "../lib/extract-asset";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  clear(): void {
    this.store = {};
  }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

beforeEach(() => {
  localStorage.clear();
});

function makeAsset(overrides?: Partial<CognitiveAsset>): CognitiveAsset {
  return {
    asset_id: "asset_1",
    created_at: new Date().toISOString(),
    source_run_id: "run_1",
    status: "confirmed",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "把想法实现为可验证路径",
    ai_generated_summary: "",
    core_insight: "先把想法变成可验证假设。",
    my_understanding: "",
    problem_it_solves: "",
    original_judgment: "",
    revised_judgment: "",
    my_judgment: "",
    transferable_value: "可迁移到产品、工程和学习任务。",
    review_questions: [],
    source_mission: "",
    confidence: 0.8,
    special_fields: {},
    full_package: {},
    connection_questions: [],
    application_questions: ["下次做功能时如何最快获得反馈？"],
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: ["功能拆解"],
      open_questions: [],
    },
    ai_suggested_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    connection_layer: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: ["功能拆解"],
      open_questions: [],
    },
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    current_version_id: "ver_1",
    versions: [
      {
        id: "ver_1",
        assetId: "asset_1",
        versionNumber: 1,
        title: "把想法实现为可验证路径",
        coreInsight: "先把想法变成可验证假设。",
        originalJudgment: "",
        revisedJudgment: "",
        myUnderstanding: "",
        transferableValue: "可迁移到产品、工程和学习任务。",
        changeReason: "初始版本",
        createdAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

describe("knowledge subcards", () => {
  it("creates, saves, and loads a subcard by parent asset id", () => {
    const card = createKnowledgeSubCard({
      parentAssetId: "asset_1",
      title: "想法是假设",
      markdownContent: KNOWLEDGE_SUBCARD_TEMPLATE,
      source: "user_created",
    });

    saveKnowledgeSubCard(card);

    const loaded = loadKnowledgeSubCards("asset_1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].parentAssetId).toBe("asset_1");
    expect(loaded[0].title).toBe("想法是假设");
    expect(loaded[0].status).toBe("saved");
  });

  it("archives a subcard without removing other cards", () => {
    const first = createKnowledgeSubCard({
      parentAssetId: "asset_1",
      title: "第一张",
      markdownContent: "content",
      source: "user_created",
    });
    const second = createKnowledgeSubCard({
      parentAssetId: "asset_1",
      title: "第二张",
      markdownContent: "content",
      source: "user_created",
    });

    saveKnowledgeSubCard(first);
    saveKnowledgeSubCard(second);
    archiveKnowledgeSubCard(first.id);

    const loaded = loadKnowledgeSubCards("asset_1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(second.id);
  });

  it("suggests drafts but does not auto-save them", () => {
    const suggestions = suggestSubCardDrafts(makeAsset());

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].parentAssetId).toBe("asset_1");
    expect(suggestions[0].source).toBe("ai_suggested_user_edited");
    expect(loadKnowledgeSubCards("asset_1")).toEqual([]);
  });

  it("uses user-built application scenarios for suggestions, not AI suggestions", () => {
    const asset = makeAsset({
      application_questions: [],
      user_built_connections: {
        related_concepts: [],
        related_assets: [],
        mental_models: [],
        prior_experience: [],
        opposite_cases: [],
        application_scenarios: ["用户真实使用场景"],
        open_questions: [],
      },
      ai_suggested_connections: {
        related_concepts: [],
        related_assets: [],
        mental_models: [],
        prior_experience: [],
        opposite_cases: [],
        application_scenarios: ["AI 候选场景"],
        open_questions: [],
      },
      connection_layer: {
        related_concepts: [],
        related_assets: [],
        mental_models: [],
        prior_experience: [],
        opposite_cases: [],
        application_scenarios: ["legacy 场景"],
        open_questions: [],
      },
    });

    const suggestions = suggestSubCardDrafts(asset);

    expect(suggestions.some((draft) => draft.corePoint === "用户真实使用场景")).toBe(true);
    expect(suggestions.some((draft) => draft.corePoint === "AI 候选场景")).toBe(false);
    expect(suggestions.some((draft) => draft.corePoint === "legacy 场景")).toBe(false);
  });
});
