import { describe, expect, it, beforeEach, vi, beforeAll } from "vitest";
import { extractAssetFromResponse, inferAssetMaturity } from "../lib/extract-asset";
import { saveAsset, loadAssets, confirmAsset, deleteAsset, searchAssets, saveAndConfirmAsset, hasAssetFromRun, updateAsset } from "../lib/asset-store";
import { loadReviewRecords, saveReviewRecord } from "../lib/review-record-store";
import type { CognitiveAsset } from "../lib/extract-asset";
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

function makeResponse(json: unknown): AnalyzeResponse {
  return {
    markdown: null,
    json,
    raw: null,
    parseStatus: "success",
    error: null,
    runLog: {
      run_id: "run_test_123_abc",
      created_at: new Date().toISOString(),
      input_snapshot: { originalGoal: "test", conversation: "test" },
      prompt_version: "v0.1",
      model_name: "test-model",
      request_status: "success",
      parse_status: "success",
      duration_ms: 100,
      error_message: null,
    },
  };
}

function makeDraftAsset(overrides?: Partial<CognitiveAsset>): CognitiveAsset {
  return {
    asset_id: "asset_test_123_abc",
    created_at: new Date().toISOString(),
    source_run_id: "run_test_123_abc",
    status: "draft",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "约束驱动选型",
    ai_generated_summary: "test summary",
    core_insight: "基于团队规模和项目阶段做技术选型",
    my_understanding: "",
    problem_it_solves: "",
    original_judgment: "微服务更酷更现代",
    revised_judgment: "模块化单体更适合小团队",
    my_judgment: "",
    transferable_value: "选型框架可迁移到其他技术决策",
    review_questions: ["团队规模多大时适合微服务？"],
    source_mission: "技术选型决策",
    confidence: 0.8,
    special_fields: { steps: ["评估团队规模", "评估项目阶段"] },
    full_package: { summary: "test" },
    connection_questions: [],
    application_questions: [],
    connection_layer: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
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
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    ...overrides,
  } as CognitiveAsset;
}

describe("extractAssetFromResponse", () => {
  it("returns null when response.json is null", () => {
    const result = extractAssetFromResponse(makeResponse(null), "run_1");
    expect(result).toBeNull();
  });

  it("returns null when asset_decision is missing", () => {
    const result = extractAssetFromResponse(makeResponse({ mission_review: {} }), "run_1");
    expect(result).toBeNull();
  });

  it("returns null when asset_candidate is false", () => {
    const result = extractAssetFromResponse(
      makeResponse({ asset_decision: { asset_candidate: false } }),
      "run_1"
    );
    expect(result).toBeNull();
  });

  it("returns null when asset_candidate_package is missing", () => {
    const result = extractAssetFromResponse(
      makeResponse({ asset_decision: { asset_candidate: true } }),
      "run_1"
    );
    expect(result).toBeNull();
  });

  it("returns null when draft_asset is missing", () => {
    const result = extractAssetFromResponse(
      makeResponse({
        asset_decision: {
          asset_candidate: true,
          asset_candidate_package: { summary: "test" },
        },
      }),
      "run_1"
    );
    expect(result).toBeNull();
  });

  it("extracts a valid CognitiveAsset from a complete response", () => {
    const result = extractAssetFromResponse(
      makeResponse({
        asset_decision: {
          asset_candidate: true,
          recommended_asset_type: "MethodCard",
          asset_candidate_package: {
            summary: "test summary",
            draft_asset: {
              type: "MethodCard",
              maturity: "Reference",
              title: "约束驱动选型",
              ai_generated_summary: "AI summary",
              core_insight: "基于团队规模做选型",
              my_understanding: "",
              problem_it_solves: "",
              original_judgment: "微服务更好",
              revised_judgment: "模块化单体更适合",
              my_judgment: "",
              transferable_value: "可迁移到其他决策",
              review_questions: ["团队多大适合微服务？"],
              source_mission: "技术选型",
              confidence: 0.8,
              special_fields: { steps: ["评估规模"] },
              connection_questions: ["这个选型框架如何迁移到非技术领域？"],
              application_questions: ["下次技术选型时你会如何应用这个框架？"],
              connection_layer: {
                related_concepts: ["约束理论", "架构决策"],
                related_assets: [],
                mental_models: ["约束驱动思维"],
                prior_experience: ["之前的项目选型经历"],
                opposite_cases: ["无约束条件下的选型"],
                application_scenarios: ["新项目启动阶段"],
                open_questions: ["约束变化时如何调整？"],
              },
              usage_evidence: [],
            },
          },
        },
      }),
      "run_test_123_abc"
    );

    expect(result).not.toBeNull();
    expect(result!.asset_id.startsWith("asset_")).toBe(true);
    expect(result!.source_run_id).toBe("run_test_123_abc");
    expect(result!.status).toBe("draft");
    expect(result!.asset_type).toBe("MethodCard");
    expect(result!.maturity).toBe("Reference");
    expect(result!.title).toBe("约束驱动选型");
    expect(result!.ai_generated_summary).toBe("AI summary");
    expect(result!.core_insight).toBe("基于团队规模做选型");
    expect(result!.my_understanding).toBe("");
    expect(result!.problem_it_solves).toBe("");
    expect(result!.original_judgment).toBe("微服务更好");
    expect(result!.revised_judgment).toBe("模块化单体更适合");
    expect(result!.my_judgment).toBe("");
    expect(result!.review_questions).toEqual(["团队多大适合微服务？"]);
    expect(result!.confidence).toBe(0.8);
    expect(result!.special_fields).toEqual({ steps: ["评估规模"] });
    expect(result!.connection_questions).toEqual(["这个选型框架如何迁移到非技术领域？"]);
    expect(result!.application_questions).toEqual(["下次技术选型时你会如何应用这个框架？"]);
    expect(result!.connection_layer).toEqual({
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    });
    expect(result!.ai_suggested_connections).toEqual({
      related_concepts: ["约束理论", "架构决策"],
      related_assets: [],
      mental_models: ["约束驱动思维"],
      prior_experience: ["之前的项目选型经历"],
      opposite_cases: ["无约束条件下的选型"],
      application_scenarios: ["新项目启动阶段"],
      open_questions: ["约束变化时如何调整？"],
    });
    expect(result!.usage_evidence).toEqual([]);
  });

  it("extracts v0.3 user fields and usage evidence", () => {
    const result = extractAssetFromResponse(
      makeResponse({
        asset_decision: {
          asset_candidate: true,
          recommended_asset_type: "MethodCard",
          asset_candidate_package: {
            summary: "test summary",
            draft_asset: {
              type: "MethodCard",
              maturity: "Ability",
              title: "约束驱动选型",
              ai_generated_summary: "AI 参考摘要",
              core_insight: "先看约束再选架构",
              my_understanding: "选型不是追新，而是约束匹配。",
              problem_it_solves: "避免小团队过早引入复杂架构。",
              original_judgment: "微服务更现代",
              revised_judgment: "小团队更适合模块化单体",
              my_judgment: "先验证核心闭环，再拆服务。",
              transferable_value: "可迁移到工具、框架、流程选择。",
              usage_evidence: [
                {
                  id: "usage_1",
                  scenario: "新项目初始化",
                  used_at: "2026-05-14",
                  action: "先做单体 MVP",
                  result: "降低了初始化成本",
                  reflection: "约束判断有效",
                },
              ],
            },
          },
        },
      }),
      "run_test_123_abc"
    );

    expect(result).not.toBeNull();
    expect(result!.maturity).toBe("Ability");
    expect(result!.ai_generated_summary).toBe("AI 参考摘要");
    expect(result!.my_understanding).toBe("选型不是追新，而是约束匹配。");
    expect(result!.problem_it_solves).toBe("避免小团队过早引入复杂架构。");
    expect(result!.my_judgment).toBe("先验证核心闭环，再拆服务。");
    expect(result!.usage_evidence).toHaveLength(1);
    expect(result!.usage_evidence[0].scenario).toBe("新项目初始化");
  });

  it("keeps v0.3 prompts as AI guidance instead of user understanding", () => {
    const result = extractAssetFromResponse(
      makeResponse({
        asset_decision: {
          asset_candidate: true,
          recommended_asset_type: "ReflectionCard",
          asset_candidate_package: {
            draft_asset: {
              type: "ReflectionCard",
              maturity: "Reference",
              title: "Evidence-first review",
              core_insight: "Do not save an asset before checking evidence.",
              my_understanding_prompt: "Rewrite this insight in your own words.",
              usage_evidence_prompt: "Record the next real use case.",
            },
          },
        },
      }),
      "run_test_123_abc",
    );

    expect(result).not.toBeNull();
    expect(result!.my_understanding).toBe("");
    expect(result!.special_fields.my_understanding_prompt).toBe("Rewrite this insight in your own words.");
    expect(result!.special_fields.usage_evidence_prompt).toBe("Record the next real use case.");
  });

  it("keeps user-built connections separate from AI suggestions", () => {
    const result = extractAssetFromResponse(
      makeResponse({
        asset_decision: {
          asset_candidate: true,
          recommended_asset_type: "MethodCard",
          asset_candidate_package: {
            summary: "test summary",
            draft_asset: {
              type: "MethodCard",
              title: "约束驱动选型",
              core_insight: "先看约束再选架构",
              user_built_connections: {
                related_concepts: ["我写下的约束概念"],
                related_assets: [],
                mental_models: [],
                prior_experience: [],
                opposite_cases: [],
                application_scenarios: ["我计划用于技术选型"],
                open_questions: [],
              },
              ai_suggested_connections: {
                related_concepts: ["AI 建议的系统边界"],
                related_assets: ["AI 建议的旧资产"],
                mental_models: [],
                prior_experience: [],
                opposite_cases: [],
                application_scenarios: [],
                open_questions: [],
              },
            },
          },
        },
      }),
      "run_test_123_abc"
    );

    expect(result).not.toBeNull();
    expect(result!.connection_layer.related_concepts).toEqual(["我写下的约束概念"]);
    expect(result!.user_built_connections.related_concepts).toEqual(["我写下的约束概念"]);
    expect(result!.ai_suggested_connections.related_concepts).toEqual(["AI 建议的系统边界"]);
    expect(result!.ai_suggested_connections.related_assets).toEqual(["AI 建议的旧资产"]);
  });

  it("falls back to recommended_asset_type when draft_asset.type is missing", () => {
    const result = extractAssetFromResponse(
      makeResponse({
        asset_decision: {
          asset_candidate: true,
          recommended_asset_type: "ConceptCard",
          asset_candidate_package: {
            draft_asset: {
              title: "test",
              core_insight: "insight",
            },
          },
        },
      }),
      "run_1"
    );

    expect(result).not.toBeNull();
    expect(result!.asset_type).toBe("ConceptCard");
  });

  it("generates unique asset_ids on successive calls", () => {
    const response = makeResponse({
      asset_decision: {
        asset_candidate: true,
        asset_candidate_package: {
          draft_asset: { title: "test", core_insight: "insight" },
        },
      },
    });

    const ids = new Set(
      Array.from({ length: 10 }, () => extractAssetFromResponse(response, "run_1")!.asset_id)
    );
    expect(ids.size).toBe(10);
  });
});

describe("inferAssetMaturity", () => {
  it("keeps AI-only assets as Reference", () => {
    expect(inferAssetMaturity(makeDraftAsset())).toBe("Reference");
  });

  it("upgrades to Understanding after user rewrite and connection", () => {
    const asset = makeDraftAsset({
      my_understanding: "我的理解",
      problem_it_solves: "它解决的问题",
      user_built_connections: {
        related_concepts: ["约束"],
        related_assets: [],
        mental_models: [],
        prior_experience: [],
        opposite_cases: [],
        application_scenarios: ["技术选型"],
        open_questions: [],
      },
      connection_layer: {
        related_concepts: ["约束"],
        related_assets: [],
        mental_models: [],
        prior_experience: [],
        opposite_cases: [],
        application_scenarios: ["技术选型"],
        open_questions: [],
      },
    });

    expect(inferAssetMaturity(asset)).toBe("Understanding");
  });

  it("upgrades to Ability when usage evidence exists", () => {
    const asset = makeDraftAsset({
      usage_evidence: [
        {
          id: "usage_1",
          scenario: "真实项目",
          used_at: "2026-05-14",
          action: "应用该判断",
          result: "决策更快",
          reflection: "有效",
        },
      ],
    });

    expect(inferAssetMaturity(asset)).toBe("Ability");
  });
});

describe("asset-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("saveAsset / loadAssets", () => {
    it("saves and loads an asset", () => {
      const asset = makeDraftAsset();
      saveAsset(asset);
      const loaded = loadAssets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].asset_id).toBe(asset.asset_id);
      expect(loaded[0].title).toBe(asset.title);
    });

    it("returns empty array when no assets stored", () => {
      expect(loadAssets()).toEqual([]);
    });

    it("replaces asset with same asset_id on save", () => {
      const asset = makeDraftAsset();
      saveAsset(asset);
      const updated = makeDraftAsset({ title: "updated title" });
      saveAsset(updated);
      const loaded = loadAssets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe("updated title");
    });

    it("prepends new asset to the beginning", () => {
      saveAsset(makeDraftAsset({ asset_id: "asset_1" }));
      saveAsset(makeDraftAsset({ asset_id: "asset_2" }));
      const loaded = loadAssets();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].asset_id).toBe("asset_2");
    });
  });

  describe("confirmAsset", () => {
    it("changes status from draft to confirmed", () => {
      const asset = makeDraftAsset();
      saveAsset(asset);
      confirmAsset(asset.asset_id);
      const loaded = loadAssets();
      expect(loaded[0].status).toBe("confirmed");
    });

    it("does nothing for non-existent asset_id", () => {
      const asset = makeDraftAsset();
      saveAsset(asset);
      confirmAsset("non_existent_id");
      const loaded = loadAssets();
      expect(loaded[0].status).toBe("draft");
    });
  });

  describe("saveAndConfirmAsset", () => {
    it("saves asset with confirmed status in a single write", () => {
      const asset = makeDraftAsset();
      expect(asset.status).toBe("draft");
      saveAndConfirmAsset(asset);
      const loaded = loadAssets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].asset_id).toBe(asset.asset_id);
      expect(loaded[0].status).toBe("confirmed");
    });

    it("does not mutate the input asset", () => {
      const asset = makeDraftAsset();
      saveAndConfirmAsset(asset);
      expect(asset.status).toBe("draft");
    });

    it("replaces existing draft asset with confirmed status", () => {
      const asset = makeDraftAsset({ asset_id: "asset_1" });
      saveAsset(asset);
      expect(loadAssets()[0].status).toBe("draft");
      const updated = makeDraftAsset({ asset_id: "asset_1", title: "updated title" });
      saveAndConfirmAsset(updated);
      const loaded = loadAssets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe("updated title");
      expect(loaded[0].status).toBe("confirmed");
    });

    it("does not throw when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(() => saveAndConfirmAsset(makeDraftAsset())).not.toThrow();
      vi.restoreAllMocks();
    });

    it("only writes to localStorage once (atomic)", () => {
      const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");
      const asset = makeDraftAsset();
      saveAndConfirmAsset(asset);
      expect(setItemSpy).toHaveBeenCalledTimes(1);
      setItemSpy.mockRestore();
    });
  });

  describe("deleteAsset", () => {
    it("removes an asset by asset_id", () => {
      saveAsset(makeDraftAsset({ asset_id: "asset_1" }));
      saveAsset(makeDraftAsset({ asset_id: "asset_2" }));
      deleteAsset("asset_1");
      const loaded = loadAssets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].asset_id).toBe("asset_2");
    });

    it("does nothing for non-existent asset_id", () => {
      saveAsset(makeDraftAsset({ asset_id: "asset_1" }));
      deleteAsset("non_existent_id");
      expect(loadAssets()).toHaveLength(1);
    });

    it("removes review records for the deleted asset", () => {
      saveAsset(makeDraftAsset({ asset_id: "asset_1" }));
      saveAsset(makeDraftAsset({ asset_id: "asset_2" }));
      saveReviewRecord({
        assetId: "asset_1",
        assetTitle: "Asset 1",
        assetMaturityBefore: "Reference",
        assetMaturityAfter: "Reference",
        reviewTypes: ["asset_card"],
        questions: ["Q1"],
        answers: ["A1"],
        feedback: [{ question: "Q1", answer: "A1", evaluation: "good", comment: "ok" }],
        overallAssessment: "ok",
        maturitySuggestion: null,
        result: "good",
        maturityUpgradeSuggested: false,
        assetUpdateSuggested: false,
      });
      saveReviewRecord({
        assetId: "asset_2",
        assetTitle: "Asset 2",
        assetMaturityBefore: "Reference",
        assetMaturityAfter: "Reference",
        reviewTypes: ["asset_card"],
        questions: ["Q2"],
        answers: ["A2"],
        feedback: [{ question: "Q2", answer: "A2", evaluation: "partial", comment: "ok" }],
        overallAssessment: "ok",
        maturitySuggestion: null,
        result: "partial",
        maturityUpgradeSuggested: false,
        assetUpdateSuggested: false,
      });

      deleteAsset("asset_1");

      expect(loadReviewRecords("asset_1")).toHaveLength(0);
      expect(loadReviewRecords("asset_2")).toHaveLength(1);
    });

    it("warns when deleting linked review records fails", () => {
      saveAsset(makeDraftAsset({ asset_id: "asset_1" }));
      saveReviewRecord({
        assetId: "asset_1",
        assetTitle: "Asset 1",
        assetMaturityBefore: "Reference",
        assetMaturityAfter: "Reference",
        reviewTypes: ["asset_card"],
        questions: ["Q1"],
        answers: ["A1"],
        feedback: [{ question: "Q1", answer: "A1", evaluation: "good", comment: "ok" }],
        overallAssessment: "ok",
        maturitySuggestion: null,
        result: "good",
        maturityUpgradeSuggested: false,
        assetUpdateSuggested: false,
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalSetItem = mockLocalStorage.setItem.bind(mockLocalStorage);
      const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem").mockImplementation((key, value) => {
        if (key === "socratic-review-records") {
          throw new Error("storage error");
        }
        originalSetItem(key, value);
      });

      deleteAsset("asset_1");

      expect(warnSpy).toHaveBeenCalledWith("deleteAsset: failed to delete review records", "asset_1");
      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("searchAssets", () => {
    beforeEach(() => {
      saveAsset(makeDraftAsset({
        asset_id: "asset_1",
        title: "约束驱动选型",
        core_insight: "基于团队规模做技术选型",
      }));
      saveAsset(makeDraftAsset({
        asset_id: "asset_2",
        title: "React useEffect 误区",
        core_insight: "useEffect 不是 componentDidMount",
        asset_type: "MisconceptionCard",
      }));
      saveAsset(makeDraftAsset({
        asset_id: "asset_3",
        title: "复盘思考模式",
        core_insight: "识别确认偏误",
        asset_type: "ReflectionCard",
      }));
    });

    it("returns all assets when query is empty", () => {
      expect(searchAssets("")).toHaveLength(3);
    });

    it("returns all assets when query is whitespace only", () => {
      expect(searchAssets("   ")).toHaveLength(3);
    });

    it("searches title case-insensitively", () => {
      const results = searchAssets("react");
      expect(results).toHaveLength(1);
      expect(results[0].asset_id).toBe("asset_2");
    });

    it("searches core_insight case-insensitively", () => {
      const results = searchAssets("团队规模");
      expect(results).toHaveLength(1);
      expect(results[0].asset_id).toBe("asset_1");
    });

    it("returns empty array when no match", () => {
      expect(searchAssets("不存在的关键词")).toHaveLength(0);
    });

    it("matches partial text in title", () => {
      const results = searchAssets("选型");
      expect(results).toHaveLength(1);
      expect(results[0].asset_id).toBe("asset_1");
    });

    it("matches partial text in core_insight", () => {
      const results = searchAssets("偏误");
      expect(results).toHaveLength(1);
      expect(results[0].asset_id).toBe("asset_3");
    });
  });

  describe("localStorage error handling", () => {
    it("loadAssets returns empty array when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(loadAssets()).toEqual([]);
      vi.restoreAllMocks();
    });

    it("saveAsset does not throw when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(() => saveAsset(makeDraftAsset())).not.toThrow();
      vi.restoreAllMocks();
    });

    it("deleteAsset does not throw when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(() => deleteAsset("any_id")).not.toThrow();
      vi.restoreAllMocks();
    });

    it("confirmAsset does not throw when localStorage throws", () => {
      const store: Record<string, string> = {};
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation((key: string) => store[key] ?? null);
      vi.spyOn(globalThis.localStorage, "setItem").mockImplementation((key: string, value: string) => {
        if (key === "socratic-cognitive-assets") throw new Error("storage error");
        store[key] = value;
      });
      saveAsset(makeDraftAsset());
      expect(() => confirmAsset("asset_test_123_abc")).not.toThrow();
      vi.restoreAllMocks();
    });

    it("searchAssets returns empty array when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(searchAssets("test")).toEqual([]);
      vi.restoreAllMocks();
    });
  });

  describe("hasAssetFromRun", () => {
    it("returns false when no assets exist", () => {
      expect(hasAssetFromRun("run_1")).toBe(false);
    });

    it("returns false when no asset matches the source_run_id", () => {
      saveAsset(makeDraftAsset({ source_run_id: "run_1" }));
      expect(hasAssetFromRun("run_2")).toBe(false);
    });

    it("returns true when an asset matches the source_run_id", () => {
      saveAsset(makeDraftAsset({ source_run_id: "run_1" }));
      expect(hasAssetFromRun("run_1")).toBe(true);
    });

    it("returns true even after multiple saves with same source_run_id", () => {
      saveAsset(makeDraftAsset({ asset_id: "a1", source_run_id: "run_1" }));
      saveAsset(makeDraftAsset({ asset_id: "a2", source_run_id: "run_1" }));
      expect(hasAssetFromRun("run_1")).toBe(true);
    });

    it("returns false when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(hasAssetFromRun("run_1")).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe("updateAsset", () => {
    it("updates an existing asset by asset_id", () => {
      const asset = makeDraftAsset({ asset_id: "asset_1", title: "original" });
      saveAsset(asset);
      const updated = makeDraftAsset({ asset_id: "asset_1", title: "updated" });
      updateAsset(updated);
      const loaded = loadAssets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe("updated");
    });

    it("does nothing when asset_id does not exist", () => {
      saveAsset(makeDraftAsset({ asset_id: "asset_1" }));
      updateAsset(makeDraftAsset({ asset_id: "asset_2", title: "new" }));
      expect(loadAssets()).toHaveLength(1);
    });

    it("does not throw when localStorage throws", () => {
      vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      expect(() => updateAsset(makeDraftAsset())).not.toThrow();
      vi.restoreAllMocks();
    });
  });
});
