import type { CognitiveAsset } from "./extract-asset";
import { inferAssetMaturity } from "./extract-asset";
import { saveAndConfirmAsset } from "./asset-store";

function cloneAsset(asset: CognitiveAsset): CognitiveAsset {
  return {
    ...asset,
    review_questions: [...asset.review_questions],
    connection_questions: [...asset.connection_questions],
    application_questions: [...asset.application_questions],
    connection_layer: {
      related_concepts: [...asset.connection_layer.related_concepts],
      related_assets: [...asset.connection_layer.related_assets],
      mental_models: [...asset.connection_layer.mental_models],
      prior_experience: [...asset.connection_layer.prior_experience],
      opposite_cases: [...asset.connection_layer.opposite_cases],
      application_scenarios: [...asset.connection_layer.application_scenarios],
      open_questions: [...asset.connection_layer.open_questions],
    },
    user_built_connections: {
      related_concepts: [...asset.user_built_connections.related_concepts],
      related_assets: [...asset.user_built_connections.related_assets],
      mental_models: [...asset.user_built_connections.mental_models],
      prior_experience: [...asset.user_built_connections.prior_experience],
      opposite_cases: [...asset.user_built_connections.opposite_cases],
      application_scenarios: [...asset.user_built_connections.application_scenarios],
      open_questions: [...asset.user_built_connections.open_questions],
    },
    ai_suggested_connections: {
      related_concepts: [...asset.ai_suggested_connections.related_concepts],
      related_assets: [...asset.ai_suggested_connections.related_assets],
      mental_models: [...asset.ai_suggested_connections.mental_models],
      prior_experience: [...asset.ai_suggested_connections.prior_experience],
      opposite_cases: [...asset.ai_suggested_connections.opposite_cases],
      application_scenarios: [...asset.ai_suggested_connections.application_scenarios],
      open_questions: [...asset.ai_suggested_connections.open_questions],
    },
    usage_evidence: asset.usage_evidence.map((item) => ({ ...item })),
    versions: asset.versions.map((v) => ({ ...v })),
  };
}

export function prepareAssetForConfirmation(asset: CognitiveAsset, currentMissionId?: string | null): CognitiveAsset {
  const baseAsset = cloneAsset(asset);
  const userBuiltAsset = {
    ...baseAsset,
    user_built_connections: { ...baseAsset.connection_layer },
  };
  const maturedAsset = {
    ...userBuiltAsset,
    maturity: inferAssetMaturity(userBuiltAsset),
  };
  const userFinalAsset = cloneAsset(maturedAsset);

  return {
    ...maturedAsset,
    user_final_asset: userFinalAsset,
    ...(currentMissionId
      ? {
          source_mission: currentMissionId,
          full_package: {
            ...(typeof maturedAsset.full_package === "object" && maturedAsset.full_package ? maturedAsset.full_package : {}),
            ...(maturedAsset.source_mission && maturedAsset.source_mission !== currentMissionId
              ? { ai_source_mission_text: maturedAsset.source_mission }
              : {}),
          },
        }
      : {}),
  };
}

export function confirmAssetDraft(asset: CognitiveAsset, currentMissionId?: string | null): CognitiveAsset {
  const toSave = prepareAssetForConfirmation(asset, currentMissionId);
  saveAndConfirmAsset(toSave);
  return toSave;
}
