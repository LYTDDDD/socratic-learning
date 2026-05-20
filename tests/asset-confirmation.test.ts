import { describe, expect, it } from "vitest";
import { prepareAssetForConfirmation } from "../lib/asset-confirmation";
import type { CognitiveAsset, ConnectionLayer } from "../lib/extract-asset";

const EMPTY_CONNECTION_LAYER: ConnectionLayer = {
  related_concepts: [],
  related_assets: [],
  mental_models: [],
  prior_experience: [],
  opposite_cases: [],
  application_scenarios: [],
  open_questions: [],
};

function makeAsset(overrides: Partial<CognitiveAsset> = {}): CognitiveAsset {
  return {
    asset_id: "asset_confirmation_1",
    created_at: "2026-05-20T00:00:00.000Z",
    source_run_id: "run_confirmation_1",
    status: "draft",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "Test asset",
    ai_generated_summary: "",
    core_insight: "Test insight",
    my_understanding: "",
    problem_it_solves: "",
    original_judgment: "",
    revised_judgment: "",
    my_judgment: "",
    transferable_value: "",
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
    current_version_id: "ver_confirmation_1",
    versions: [],
    ...overrides,
  };
}

describe("prepareAssetForConfirmation", () => {
  it("does not promote AI suggested connections into user-built connections", () => {
    const aiConnections: ConnectionLayer = {
      ...EMPTY_CONNECTION_LAYER,
      related_concepts: ["AI suggested concept"],
      application_scenarios: ["AI suggested scenario"],
    };
    const asset = makeAsset({
      connection_layer: aiConnections,
      ai_suggested_connections: aiConnections,
      user_built_connections: { ...EMPTY_CONNECTION_LAYER },
    });

    const result = prepareAssetForConfirmation(asset);

    expect(result.user_built_connections.related_concepts).toEqual([]);
    expect(result.user_built_connections.application_scenarios).toEqual([]);
    expect(result.connection_layer.related_concepts).toEqual([]);
    expect(result.ai_suggested_connections.related_concepts).toEqual(["AI suggested concept"]);
    expect(result.maturity).toBe("Reference");
  });
});
