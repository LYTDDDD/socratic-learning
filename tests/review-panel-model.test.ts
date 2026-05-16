import { describe, expect, it } from "vitest";
import type { CognitiveAsset } from "../lib/extract-asset";
import { buildReviewPanelModel } from "../lib/review-panel-model";
import type { ReviewRecord } from "../lib/review-record-store";

function makeAsset(overrides: Partial<CognitiveAsset> = {}): CognitiveAsset {
  return {
    asset_id: "asset_default",
    title: "Default Asset",
    core_insight: "Core insight",
    original_judgment: "Original judgment",
    revised_judgment: "Revised judgment",
    my_understanding: "My understanding",
    transferable_value: "Transferable value",
    review_questions: [],
    connection_questions: [],
    application_questions: [],
    asset_type: "MethodCard",
    status: "confirmed",
    maturity: "Reference",
    confidence: 0.8,
    source_run_id: "run_1",
    source_mission: "",
    created_at: "2026-05-15T00:00:00.000Z",
    special_fields: {},
    connection_layer: {
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
    ai_generated_summary: "",
    versions: [],
    current_version_id: "",
    problem_it_solves: "",
    my_judgment: "",
    full_package: {},
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    ai_generated_draft: {},
    user_final_asset: null,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "review_default",
    assetId: "asset_default",
    assetTitle: "Default Asset",
    reviewedAt: "2026-05-15T00:00:00.000Z",
    assetMaturityBefore: "Reference",
    assetMaturityAfter: "Reference",
    reviewTypes: ["asset_card"],
    questions: ["Q"],
    answers: ["A"],
    feedback: [{ question: "Q", answer: "A", evaluation: "good", comment: "ok" }],
    overallAssessment: "ok",
    maturitySuggestion: null,
    result: "good",
    maturityUpgradeSuggested: false,
    assetUpdateSuggested: false,
    createdAt: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildReviewPanelModel", () => {
  it("filters assets and records by mission id", () => {
    const assets = [
      makeAsset({ asset_id: "asset_a", source_mission: "mission_a" }),
      makeAsset({ asset_id: "asset_b", source_mission: "mission_b" }),
    ];
    const records = [
      makeRecord({ id: "review_a", assetId: "asset_a" }),
      makeRecord({ id: "review_b", assetId: "asset_b" }),
    ];

    const model = buildReviewPanelModel(assets, records, "mission_a");

    expect(model.visibleAssets.map((asset) => asset.asset_id)).toEqual(["asset_a"]);
    expect(model.visibleRecords.map((record) => record.id)).toEqual(["review_a"]);
  });

  it("keeps all assets and records without a mission id", () => {
    const assets = [
      makeAsset({ asset_id: "asset_a", source_mission: "mission_a" }),
      makeAsset({ asset_id: "asset_b", source_mission: "mission_b" }),
    ];
    const records = [
      makeRecord({ id: "review_a", assetId: "asset_a" }),
      makeRecord({ id: "review_b", assetId: "asset_b" }),
    ];

    const model = buildReviewPanelModel(assets, records, null);

    expect(model.visibleAssets).toHaveLength(2);
    expect(model.visibleRecords).toHaveLength(2);
  });

  it("calculates review stats and pass rate", () => {
    const assets = [
      makeAsset({ asset_id: "asset_a" }),
      makeAsset({ asset_id: "asset_b" }),
    ];
    const records = [
      makeRecord({ id: "review_good", assetId: "asset_a", result: "good", reviewedAt: "2026-05-16T00:00:00.000Z" }),
      makeRecord({ id: "review_partial", assetId: "asset_a", result: "partial", reviewedAt: "2026-05-15T00:00:00.000Z" }),
    ];

    const model = buildReviewPanelModel(assets, records);

    expect(model.stats.totalReviews).toBe(2);
    expect(model.stats.goodCount).toBe(1);
    expect(model.stats.passRate).toBe(50);
    expect(model.stats.lastReviewAt).toBe("2026-05-16T00:00:00.000Z");
    expect(model.stats.reviewedAssetIds.has("asset_a")).toBe(true);
    expect(model.stats.neverReviewed.map((asset) => asset.asset_id)).toEqual(["asset_b"]);
  });

  it("only marks confirmed assets as never reviewed", () => {
    const assets = [
      makeAsset({ asset_id: "asset_confirmed", status: "confirmed" }),
      makeAsset({ asset_id: "asset_draft", status: "draft" }),
    ];

    const model = buildReviewPanelModel(assets, []);

    expect(model.confirmedAssets.map((asset) => asset.asset_id)).toEqual(["asset_confirmed"]);
    expect(model.stats.neverReviewed.map((asset) => asset.asset_id)).toEqual(["asset_confirmed"]);
    expect(model.stats.passRate).toBe(0);
    expect(model.stats.lastReviewAt).toBeNull();
  });
});
