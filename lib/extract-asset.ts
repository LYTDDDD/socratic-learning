import type { AnalyzeResponse } from "./analyze-types";

export type ConnectionLayer = {
  related_concepts: string[];
  related_assets: string[];
  mental_models: string[];
  prior_experience: string[];
  opposite_cases: string[];
  application_scenarios: string[];
  open_questions: string[];
};

export type CardMaturity = "Reference" | "Understanding" | "Ability";

export type UsageEvidence = {
  id: string;
  scenario: string;
  used_at: string;
  action: string;
  result: string;
  reflection: string;
};

export type AssetVersion = {
  id: string;
  assetId: string;
  versionNumber: number;
  title: string;
  coreInsight: string;
  originalJudgment: string;
  revisedJudgment: string;
  myUnderstanding: string;
  transferableValue: string;
  changeReason?: string;
  createdAt: string;
};

export type CognitiveAsset = {
  asset_id: string;
  created_at: string;
  source_run_id: string;
  status: "draft" | "confirmed";
  asset_type: string;
  maturity: CardMaturity;
  title: string;
  ai_generated_summary: string;
  core_insight: string;
  my_understanding: string;
  problem_it_solves: string;
  original_judgment: string;
  revised_judgment: string;
  my_judgment: string;
  transferable_value: string;
  review_questions: string[];
  source_mission: string;
  confidence: number;
  special_fields: Record<string, unknown>;
  full_package: Record<string, unknown>;
  connection_questions: string[];
  application_questions: string[];
  user_built_connections: ConnectionLayer;
  ai_suggested_connections: ConnectionLayer;
  connection_layer: ConnectionLayer;
  usage_evidence: UsageEvidence[];
  ai_generated_draft: Record<string, unknown>;
  user_final_asset: Record<string, unknown> | null;
  current_version_id: string;
  versions: AssetVersion[];
};

function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateVersionId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeMaturity(value: unknown): CardMaturity {
  if (value === "Understanding" || value === "Ability") return value;
  return "Reference";
}

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

export function inferAssetMaturity(asset: CognitiveAsset): CardMaturity {
  if (asset.usage_evidence.length > 0) return "Ability";

  const hasConnection = Object.values(asset.user_built_connections).some((items) => items.length > 0);
  const hasUserRewrite =
    asset.my_understanding.trim().length > 0 &&
    asset.problem_it_solves.trim().length > 0 &&
    hasConnection &&
    asset.user_built_connections.application_scenarios.length > 0;

  return hasUserRewrite ? "Understanding" : "Reference";
}

export function extractAssetFromResponse(
  response: AnalyzeResponse,
  runId: string
): CognitiveAsset | null {
  if (!response.json || typeof response.json !== "object") return null;

  const json = response.json as Record<string, unknown>;

  const decision = json.asset_decision as Record<string, unknown> | undefined;
  if (decision && decision.asset_candidate === true) {
    const pkg = decision.asset_candidate_package as Record<string, unknown> | undefined;
    if (!pkg) return null;

    const draft = pkg.draft_asset as Record<string, unknown> | undefined;
    if (!draft || typeof draft !== "object") return null;

    return buildAssetFromDraft(draft, runId, decision.recommended_asset_type as string | undefined, pkg);
  }

  if (!decision && looksLikeFlatAsset(json)) {
    return buildAssetFromDraft(json, runId, undefined, json);
  }

  return null;
}

function looksLikeFlatAsset(json: Record<string, unknown>): boolean {
  const assetIndicators = ["core_insight", "original_judgment", "revised_judgment", "transferable_value"];
  const matchCount = assetIndicators.filter((key) => typeof json[key] === "string" && (json[key] as string).length > 0).length;
  return matchCount >= 2;
}

function buildAssetFromDraft(
  draft: Record<string, unknown>,
  runId: string,
  recommendedType: string | undefined,
  fullPkg: Record<string, unknown>
): CognitiveAsset {
  const defaultConnectionLayer: ConnectionLayer = {
    related_concepts: [],
    related_assets: [],
    mental_models: [],
    prior_experience: [],
    opposite_cases: [],
    application_scenarios: [],
    open_questions: [],
  };
  const user_built_connections = normalizeConnectionLayer(draft.user_built_connections, defaultConnectionLayer);
  const ai_suggested_connections = normalizeConnectionLayer(
    draft.ai_suggested_connections ?? draft.connection_layer,
    defaultConnectionLayer
  );

  const now = new Date().toISOString();
  const assetId = generateAssetId();
  const initialVersionId = generateVersionId();
  const title = (draft.title as string) ?? "";
  const coreInsight = (draft.core_insight as string) ?? "";
  const originalJudgment = (draft.original_judgment as string) ?? "";
  const revisedJudgment = (draft.revised_judgment as string) ?? "";
  const myUnderstanding = (draft.my_understanding as string) ?? "";
  const transferableValue = (draft.transferable_value as string) ?? "";
  const specialFields = {
    ...((draft.special_fields as Record<string, unknown>) ?? {}),
    ...(typeof draft.my_understanding_prompt === "string" && draft.my_understanding_prompt.trim()
      ? { my_understanding_prompt: draft.my_understanding_prompt }
      : {}),
    ...(typeof draft.usage_evidence_prompt === "string" && draft.usage_evidence_prompt.trim()
      ? { usage_evidence_prompt: draft.usage_evidence_prompt }
      : {}),
  };

  const initialVersion: AssetVersion = {
    id: initialVersionId,
    assetId,
    versionNumber: 1,
    title,
    coreInsight,
    originalJudgment,
    revisedJudgment,
    myUnderstanding,
    transferableValue,
    changeReason: "初始版本",
    createdAt: now,
  };

  return {
    asset_id: assetId,
    created_at: now,
    source_run_id: runId,
    status: "draft",
    asset_type: (draft.type as string) ?? recommendedType ?? "ConceptCard",
    maturity: normalizeMaturity(draft.maturity),
    title,
    ai_generated_summary: (draft.ai_generated_summary as string) ?? (fullPkg.summary as string) ?? "",
    core_insight: coreInsight,
    my_understanding: myUnderstanding,
    problem_it_solves: (draft.problem_it_solves as string) ?? "",
    original_judgment: originalJudgment,
    revised_judgment: revisedJudgment,
    my_judgment: (draft.my_judgment as string) ?? "",
    transferable_value: transferableValue,
    review_questions: asStringArray(draft.review_questions),
    source_mission: (draft.source_mission as string) ?? "",
    confidence: typeof draft.confidence === "number" ? draft.confidence : 0,
    special_fields: specialFields,
    full_package: fullPkg,
    connection_questions: asStringArray(draft.connection_questions),
    application_questions: asStringArray(draft.application_questions),
    user_built_connections,
    ai_suggested_connections,
    connection_layer: user_built_connections,
    usage_evidence: normalizeUsageEvidence(draft.usage_evidence),
    ai_generated_draft: draft,
    user_final_asset: null,
    current_version_id: initialVersionId,
    versions: [initialVersion],
  };
}

function normalizeConnectionLayer(value: unknown, fallback: ConnectionLayer): ConnectionLayer {
  const raw = value as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return { ...fallback };

  return {
    related_concepts: asStringArray(raw.related_concepts),
    related_assets: asStringArray(raw.related_assets),
    mental_models: asStringArray(raw.mental_models),
    prior_experience: asStringArray(raw.prior_experience ?? raw.prior_experience_prompts),
    opposite_cases: asStringArray(raw.opposite_cases),
    application_scenarios: asStringArray(raw.application_scenarios),
    open_questions: asStringArray(raw.open_questions),
  };
}
