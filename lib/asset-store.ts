import type { CognitiveAsset, ConnectionLayer, UsageEvidence, AssetVersion } from "./extract-asset";
import { generateVersionId } from "./extract-asset";
import { deleteReviewRecordsByAssetId } from "./review-record-store";

const STORAGE_KEY = "socratic-cognitive-assets";

const EMPTY_CONNECTION_LAYER: ConnectionLayer = {
  related_concepts: [],
  related_assets: [],
  mental_models: [],
  prior_experience: [],
  opposite_cases: [],
  application_scenarios: [],
  open_questions: [],
};

function normalizeUsageEvidence(value: unknown): UsageEvidence[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item, index) => ({
      id: typeof item.id === "string" ? item.id : `usage_${index + 1}`,
      scenario: typeof item.scenario === "string" ? item.scenario : "",
      used_at: typeof item.used_at === "string" ? item.used_at : "",
      action: typeof item.action === "string" ? item.action : "",
      result: typeof item.result === "string" ? item.result : "",
      reflection: typeof item.reflection === "string" ? item.reflection : "",
    }))
    .filter((item) => item.scenario || item.action || item.result || item.reflection);
}

function normalizeConnectionLayer(value: unknown): ConnectionLayer {
  if (!value || typeof value !== "object") return { ...EMPTY_CONNECTION_LAYER };
  const raw = value as Partial<ConnectionLayer>;

  return {
    related_concepts: Array.isArray(raw.related_concepts) ? raw.related_concepts : [],
    related_assets: Array.isArray(raw.related_assets) ? raw.related_assets : [],
    mental_models: Array.isArray(raw.mental_models) ? raw.mental_models : [],
    prior_experience: Array.isArray(raw.prior_experience) ? raw.prior_experience : [],
    opposite_cases: Array.isArray(raw.opposite_cases) ? raw.opposite_cases : [],
    application_scenarios: Array.isArray(raw.application_scenarios) ? raw.application_scenarios : [],
    open_questions: Array.isArray(raw.open_questions) ? raw.open_questions : [],
  };
}

function migrateAsset(a: Record<string, unknown>): CognitiveAsset {
  const legacyConnectionLayer = normalizeConnectionLayer(a.connection_layer);
  const userBuiltConnections = a.user_built_connections
    ? normalizeConnectionLayer(a.user_built_connections)
    : legacyConnectionLayer;

  const assetId = a.asset_id as string;
  const title = (a.title as string) ?? "";
  const coreInsight = (a.core_insight as string) ?? "";
  const originalJudgment = (a.original_judgment as string) ?? "";
  const revisedJudgment = (a.revised_judgment as string) ?? "";
  const myUnderstanding = (a.my_understanding as string) ?? "";
  const transferableValue = (a.transferable_value as string) ?? "";
  const createdAt = a.created_at as string;

  const existingVersions = Array.isArray(a.versions)
    ? (a.versions as AssetVersion[]).map((v) => ({
        ...v,
        assetId: v.assetId || assetId,
      }))
    : undefined;

  const versions: AssetVersion[] =
    existingVersions && existingVersions.length > 0
      ? existingVersions
      : [
          {
            id: `ver_legacy_${assetId}`,
            assetId,
            versionNumber: 1,
            title,
            coreInsight,
            originalJudgment,
            revisedJudgment,
            myUnderstanding,
            transferableValue,
            changeReason: "初始版本",
            createdAt,
          },
        ];

  const currentVersionId = (a.current_version_id as string) || versions[versions.length - 1].id;

  return {
    asset_id: assetId,
    created_at: createdAt,
    source_run_id: a.source_run_id as string,
    status: (a.status as "draft" | "confirmed") ?? "draft",
    asset_type: (a.asset_type as string) ?? "ConceptCard",
    maturity: a.maturity === "Understanding" || a.maturity === "Ability" ? a.maturity : "Reference",
    title,
    ai_generated_summary: (a.ai_generated_summary as string) ?? "",
    core_insight: coreInsight,
    my_understanding: myUnderstanding,
    problem_it_solves: (a.problem_it_solves as string) ?? "",
    original_judgment: originalJudgment,
    revised_judgment: revisedJudgment,
    my_judgment: (a.my_judgment as string) ?? "",
    transferable_value: transferableValue,
    review_questions: Array.isArray(a.review_questions) ? a.review_questions as string[] : [],
    source_mission: (a.source_mission as string) ?? "",
    confidence: typeof a.confidence === "number" ? a.confidence : 0,
    special_fields: (a.special_fields as Record<string, unknown>) ?? {},
    full_package: (a.full_package as Record<string, unknown>) ?? {},
    connection_questions: Array.isArray(a.connection_questions) ? a.connection_questions as string[] : [],
    application_questions: Array.isArray(a.application_questions) ? a.application_questions as string[] : [],
    user_built_connections: userBuiltConnections,
    ai_suggested_connections: normalizeConnectionLayer(a.ai_suggested_connections),
    connection_layer: userBuiltConnections,
    usage_evidence: normalizeUsageEvidence(a.usage_evidence),
    ai_generated_draft: (a.ai_generated_draft as Record<string, unknown>) ?? {},
    user_final_asset: (a.user_final_asset as Record<string, unknown> | null) ?? null,
    current_version_id: currentVersionId,
    versions,
  };
}

export function saveAsset(asset: CognitiveAsset): void {
  try {
    const assets = loadAssets();
    const filtered = assets.filter((a) => a.asset_id !== asset.asset_id);
    filtered.unshift(asset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function loadAssets(): CognitiveAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a: Record<string, unknown>) => migrateAsset(a));
  } catch {
    return [];
  }
}

export function confirmAsset(assetId: string): void {
  try {
    const assets = loadAssets();
    const target = assets.find((a) => a.asset_id === assetId);
    if (target) {
      target.status = "confirmed";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    }
  } catch {}
}

export function saveAndConfirmAsset(asset: CognitiveAsset): void {
  try {
    const assets = loadAssets();
    const filtered = assets.filter((a) => a.asset_id !== asset.asset_id);
    const confirmedAsset: CognitiveAsset = { ...asset, status: "confirmed" };
    filtered.unshift(confirmedAsset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function deleteAsset(assetId: string): void {
  try {
    const assets = loadAssets();
    const filtered = assets.filter((a) => a.asset_id !== assetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    const reviewsDeleted = deleteReviewRecordsByAssetId(assetId);
    if (!reviewsDeleted) {
      console.warn("deleteAsset: failed to delete review records", assetId);
    }
  } catch {}
}

export function searchAssets(query: string): CognitiveAsset[] {
  try {
    const assets = loadAssets();
    if (!query.trim()) return assets;
    const lower = query.toLowerCase();
    return assets.filter(
      (a) =>
        a.title.toLowerCase().includes(lower) ||
        a.core_insight.toLowerCase().includes(lower)
    );
  } catch {
    return [];
  }
}

export function hasAssetFromRun(sourceRunId: string): boolean {
  try {
    const assets = loadAssets();
    return assets.some((a) => a.source_run_id === sourceRunId);
  } catch {
    return false;
  }
}

export function updateAsset(asset: CognitiveAsset): void {
  try {
    const assets = loadAssets();
    const idx = assets.findIndex((a) => a.asset_id === asset.asset_id);
    if (idx >= 0) {
      assets[idx] = asset;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    }
  } catch {}
}

export function minorEditAsset(asset: CognitiveAsset, updates: Partial<CognitiveAsset>): CognitiveAsset {
  const updated = { ...asset, ...updates };
  const currentVersionIdx = updated.versions.findIndex(
    (v) => v.id === updated.current_version_id,
  );
  if (currentVersionIdx >= 0) {
    const patched = { ...updated };
    patched.versions = patched.versions.map((v, i) =>
      i === currentVersionIdx
        ? {
            ...v,
            title: updated.title,
            coreInsight: updated.core_insight,
            originalJudgment: updated.original_judgment,
            revisedJudgment: updated.revised_judgment,
            myUnderstanding: updated.my_understanding,
            transferableValue: updated.transferable_value,
          }
        : v,
    );
    updateAsset(patched);
    return patched;
  }
  updateAsset(updated);
  return updated;
}

export function createAssetVersion(
  asset: CognitiveAsset,
  updates: Partial<CognitiveAsset>,
  changeReason: string,
): CognitiveAsset {
  const now = new Date().toISOString();
  const newVersionId = generateVersionId();
  const latestVersionNumber =
    asset.versions.length > 0
      ? Math.max(...asset.versions.map((v) => v.versionNumber))
      : 0;

  const newVersion: AssetVersion = {
    id: newVersionId,
    assetId: asset.asset_id,
    versionNumber: latestVersionNumber + 1,
    title: updates.title ?? asset.title,
    coreInsight: updates.core_insight ?? asset.core_insight,
    originalJudgment: updates.original_judgment ?? asset.original_judgment,
    revisedJudgment: updates.revised_judgment ?? asset.revised_judgment,
    myUnderstanding: updates.my_understanding ?? asset.my_understanding,
    transferableValue: updates.transferable_value ?? asset.transferable_value,
    changeReason,
    createdAt: now,
  };

  const updatedAsset: CognitiveAsset = {
    ...asset,
    ...updates,
    current_version_id: newVersionId,
    versions: [...asset.versions, newVersion],
  };

  updateAsset(updatedAsset);
  return updatedAsset;
}
