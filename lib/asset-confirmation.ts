import type { CognitiveAsset, ConnectionLayer } from "./extract-asset";
import { inferAssetMaturity } from "./extract-asset";
import { saveAndConfirmAsset } from "./asset-store";

function cloneConnectionLayer(connectionLayer: ConnectionLayer): ConnectionLayer {
  return {
    related_concepts: [...connectionLayer.related_concepts],
    related_assets: [...connectionLayer.related_assets],
    mental_models: [...connectionLayer.mental_models],
    prior_experience: [...connectionLayer.prior_experience],
    opposite_cases: [...connectionLayer.opposite_cases],
    application_scenarios: [...connectionLayer.application_scenarios],
    open_questions: [...connectionLayer.open_questions],
  };
}

function cloneAsset(asset: CognitiveAsset): CognitiveAsset {
  return {
    ...asset,
    review_questions: [...asset.review_questions],
    connection_questions: [...asset.connection_questions],
    application_questions: [...asset.application_questions],
    connection_layer: cloneConnectionLayer(asset.connection_layer),
    user_built_connections: cloneConnectionLayer(asset.user_built_connections),
    ai_suggested_connections: cloneConnectionLayer(asset.ai_suggested_connections),
    usage_evidence: asset.usage_evidence.map((item) => ({ ...item })),
    versions: asset.versions.map((v) => ({ ...v })),
  };
}

export function prepareAssetForConfirmation(asset: CognitiveAsset, currentMissionId?: string | null): CognitiveAsset {
  const baseAsset = cloneAsset(asset);
  const userBuiltConnections = cloneConnectionLayer(baseAsset.user_built_connections);
  const userBuiltAsset = {
    ...baseAsset,
    user_built_connections: userBuiltConnections,
    connection_layer: cloneConnectionLayer(userBuiltConnections),
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
