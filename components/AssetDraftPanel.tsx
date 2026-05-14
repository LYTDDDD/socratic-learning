"use client";

import { useEffect, useState } from "react";
import type { CognitiveAsset, ConnectionLayer, UsageEvidence } from "../lib/extract-asset";
import { inferAssetMaturity } from "../lib/extract-asset";
import { saveAndConfirmAsset } from "../lib/asset-store";

type AssetDraftPanelProps = {
  asset: CognitiveAsset;
  onConfirm: () => void;
  onDiscard: () => void;
};

function typeBadgeColor(type: string): string {
  switch (type) {
    case "MethodCard":
      return "bg-blue-100 text-blue-800";
    case "MisconceptionCard":
      return "bg-red-100 text-red-800";
    case "ReflectionCard":
      return "bg-purple-100 text-purple-800";
    case "ConceptCard":
      return "bg-green-100 text-green-800";
    case "CaseCard":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function maturityBadgeColor(maturity: string): string {
  switch (maturity) {
    case "Ability":
      return "bg-emerald-100 text-emerald-800";
    case "Understanding":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-stone-100 text-stone-800";
  }
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <dt className="text-xs font-medium text-ink/60">{label}</dt>
      <textarea
        className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        value={value}
      />
    </div>
  );
}

function parseLines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function parseUsageEvidence(value: string): UsageEvidence[] {
  return parseLines(value).map((line, index) => ({
    id: `usage_${index + 1}`,
    scenario: line,
    used_at: "",
    action: "",
    result: "",
    reflection: "",
  }));
}

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

function hasAnyConnection(connectionLayer: ConnectionLayer): boolean {
  return Object.values(connectionLayer).some((items) => items.length > 0);
}

function flattenConnectionLayer(connectionLayer: ConnectionLayer): string[] {
  return Object.values(connectionLayer).flat();
}

export function AssetDraftPanel({ asset, onConfirm, onDiscard }: AssetDraftPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedAsset, setEditedAsset] = useState<CognitiveAsset>(() => cloneAsset(asset));
  const [showAiConnections, setShowAiConnections] = useState(false);

  useEffect(() => {
    setConfirmed(false);
    setEditing(false);
    setShowAiConnections(false);
    setEditedAsset(cloneAsset(asset));
  }, [asset.asset_id]);

  function handleConfirm() {
    const baseAsset = editing ? editedAsset : asset;
    const userBuiltAsset = {
      ...cloneAsset(baseAsset),
      user_built_connections: { ...baseAsset.connection_layer },
    };
    const maturedAsset = {
      ...userBuiltAsset,
      maturity: inferAssetMaturity(userBuiltAsset),
    };
    const userFinalAsset = cloneAsset(maturedAsset);
    const toSave: CognitiveAsset = {
      ...maturedAsset,
      user_final_asset: userFinalAsset,
    };
    saveAndConfirmAsset(toSave);
    setConfirmed(true);
    onConfirm();
  }

  function handleFieldChange(field: keyof CognitiveAsset, value: string | string[]) {
    setEditedAsset((prev) => ({ ...prev, [field]: value }));
  }

  function handleConnectionLayerChange(field: keyof ConnectionLayer, value: string[]) {
    setEditedAsset((prev) => ({
      ...prev,
      connection_layer: { ...prev.connection_layer, [field]: value },
      user_built_connections: { ...prev.user_built_connections, [field]: value },
    }));
  }

  function handleUsageEvidenceChange(value: string) {
    setEditedAsset((prev) => ({
      ...prev,
      usage_evidence: parseUsageEvidence(value),
    }));
  }

  if (confirmed) {
    return (
      <div className="rounded-lg border border-moss/40 bg-moss/5 p-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold text-moss">资产已确认入库</span>
        </div>
      </div>
    );
  }

  const displayAsset = editing ? editedAsset : asset;

  return (
    <div className="rounded-lg border border-moss/30 bg-moss/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${typeBadgeColor(displayAsset.asset_type)}`}>
          {displayAsset.asset_type}
        </span>
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${maturityBadgeColor(displayAsset.maturity)}`}>
          {displayAsset.maturity}
        </span>
        <span className="inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
          草稿
        </span>
        {editing && (
          <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            编辑中
          </span>
        )}
      </div>

      {editing ? (
        <>
          <EditableField label="标题" value={editedAsset.title} onChange={(v) => handleFieldChange("title", v)} />
          <EditableField label="核心洞察" value={editedAsset.core_insight} onChange={(v) => handleFieldChange("core_insight", v)} />
          <EditableField label="我的理解" value={editedAsset.my_understanding} onChange={(v) => handleFieldChange("my_understanding", v)} />
          <EditableField label="它解决什么问题" value={editedAsset.problem_it_solves} onChange={(v) => handleFieldChange("problem_it_solves", v)} />
          <EditableField label="原始判断" value={editedAsset.original_judgment} onChange={(v) => handleFieldChange("original_judgment", v)} />
          <EditableField label="修正后判断" value={editedAsset.revised_judgment} onChange={(v) => handleFieldChange("revised_judgment", v)} />
          <EditableField label="我的判断" value={editedAsset.my_judgment} onChange={(v) => handleFieldChange("my_judgment", v)} />
          <EditableField label="可迁移价值" value={editedAsset.transferable_value} onChange={(v) => handleFieldChange("transferable_value", v)} />
          <div className="mb-3">
            <dt className="text-xs font-medium text-ink/60">复习问题（每行一个）</dt>
            <textarea
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
              onChange={(e) => handleFieldChange("review_questions", parseLines(e.target.value))}
              rows={3}
              value={editedAsset.review_questions.join("\n")}
            />
          </div>
          <div className="mb-3">
            <dt className="text-xs font-medium text-ink/60">连接问题（每行一个）</dt>
            <textarea
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
              onChange={(e) => handleFieldChange("connection_questions", parseLines(e.target.value))}
              rows={3}
              value={editedAsset.connection_questions.join("\n")}
            />
          </div>
          <div className="mb-3">
            <dt className="text-xs font-medium text-ink/60">应用问题（每行一个）</dt>
            <textarea
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
              onChange={(e) => handleFieldChange("application_questions", parseLines(e.target.value))}
              rows={3}
              value={editedAsset.application_questions.join("\n")}
            />
          </div>
          <div className="mb-3 rounded-md border border-line bg-white p-3">
            <h5 className="mb-2 text-xs font-semibold text-ink/70">连接层</h5>
            <div className="mb-2">
              <dt className="text-xs font-medium text-ink/60">相关概念（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("related_concepts", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.related_concepts.join("\n")}
              />
            </div>
            <div className="mb-2">
              <dt className="text-xs font-medium text-ink/60">相关资产（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("related_assets", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.related_assets.join("\n")}
              />
            </div>
            <div className="mb-2">
              <dt className="text-xs font-medium text-ink/60">相关思维模型（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("mental_models", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.mental_models.join("\n")}
              />
            </div>
            <div className="mb-2">
              <dt className="text-xs font-medium text-ink/60">相关个人经验（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("prior_experience", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.prior_experience.join("\n")}
              />
            </div>
            <div className="mb-2">
              <dt className="text-xs font-medium text-ink/60">反面案例（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("opposite_cases", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.opposite_cases.join("\n")}
              />
            </div>
            <div className="mb-2">
              <dt className="text-xs font-medium text-ink/60">应用场景（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("application_scenarios", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.application_scenarios.join("\n")}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/60">未解决问题（每行一个）</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => handleConnectionLayerChange("open_questions", parseLines(e.target.value))}
                rows={2}
                value={editedAsset.connection_layer.open_questions.join("\n")}
              />
            </div>
          </div>
          <div className="mb-3">
            <dt className="text-xs font-medium text-ink/60">使用证据（每行一个真实使用场景）</dt>
            <textarea
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
              onChange={(e) => handleUsageEvidenceChange(e.target.value)}
              rows={3}
              value={editedAsset.usage_evidence.map((item) => item.scenario).join("\n")}
            />
          </div>
        </>
      ) : (
        <>
          <h4 className="mb-2 text-base font-semibold text-ink">{displayAsset.title || "未命名资产"}</h4>

          {displayAsset.core_insight && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-ink/60">核心洞察</dt>
              <dd className="mt-0.5 text-sm text-ink">{displayAsset.core_insight}</dd>
            </div>
          )}

          {(displayAsset.my_understanding || displayAsset.problem_it_solves || displayAsset.my_judgment) && (
            <div className="mb-3 rounded-md border border-line bg-white p-3">
              {displayAsset.my_understanding && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">我的理解</dt>
                  <dd className="mt-0.5 text-sm text-ink">{displayAsset.my_understanding}</dd>
                </div>
              )}
              {displayAsset.problem_it_solves && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">它解决什么问题</dt>
                  <dd className="mt-0.5 text-sm text-ink">{displayAsset.problem_it_solves}</dd>
                </div>
              )}
              {displayAsset.my_judgment && (
                <div>
                  <dt className="text-xs font-medium text-ink/60">我的判断</dt>
                  <dd className="mt-0.5 text-sm text-ink">{displayAsset.my_judgment}</dd>
                </div>
              )}
            </div>
          )}

          {(displayAsset.original_judgment || displayAsset.revised_judgment) && (
            <div className="mb-3 rounded-md border border-line bg-white p-3">
              <div className="mb-2">
                <dt className="text-xs font-medium text-ink/60">原始判断</dt>
                <dd className="mt-0.5 text-sm text-rust">{displayAsset.original_judgment || "—"}</dd>
              </div>
              <div className="flex items-center justify-center">
                <svg className="h-4 w-4 text-ink/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink/60">修正后判断</dt>
                <dd className="mt-0.5 text-sm text-moss">{displayAsset.revised_judgment || "—"}</dd>
              </div>
            </div>
          )}

          {displayAsset.transferable_value && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-ink/60">可迁移价值</dt>
              <dd className="mt-0.5 text-sm text-ink">{displayAsset.transferable_value}</dd>
            </div>
          )}

          {displayAsset.review_questions.length > 0 && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-ink/60">复习问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {displayAsset.review_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {displayAsset.connection_questions.length > 0 && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-ink/60">连接问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {displayAsset.connection_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {displayAsset.application_questions.length > 0 && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-ink/60">应用问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {displayAsset.application_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {Object.values(displayAsset.connection_layer).some((arr) => arr.length > 0) && (
            <div className="mb-3 rounded-md border border-line bg-white p-3">
              <h5 className="mb-2 text-xs font-semibold text-ink/70">连接层</h5>
              {displayAsset.connection_layer.related_concepts.length > 0 && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">相关概念</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.related_concepts.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayAsset.connection_layer.related_assets.length > 0 && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">相关资产</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.related_assets.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayAsset.connection_layer.mental_models.length > 0 && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">相关思维模型</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.mental_models.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayAsset.connection_layer.prior_experience.length > 0 && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">相关个人经验</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.prior_experience.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayAsset.connection_layer.opposite_cases.length > 0 && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">反面案例</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.opposite_cases.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayAsset.connection_layer.application_scenarios.length > 0 && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">应用场景</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.application_scenarios.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {displayAsset.connection_layer.open_questions.length > 0 && (
                <div>
                  <dt className="text-xs font-medium text-ink/60">未解决问题</dt>
                  <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                    {displayAsset.connection_layer.open_questions.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {displayAsset.usage_evidence.length > 0 && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-ink/60">使用证据</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {displayAsset.usage_evidence.map((item) => (
                  <li key={item.id}>{item.scenario || item.action || item.result}</li>
                ))}
              </ul>
            </div>
          )}

          {hasAnyConnection(displayAsset.connection_layer) && hasAnyConnection(displayAsset.ai_suggested_connections) && (
            <div className="mb-3">
              <button
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:bg-white hover:text-ink"
                onClick={() => setShowAiConnections((v) => !v)}
                type="button"
              >
                {showAiConnections ? "隐藏 AI 候选连接" : "显示 AI 候选连接"}
              </button>
              {showAiConnections && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 rounded-md border border-line bg-white p-3 text-sm text-ink">
                  {flattenConnectionLayer(displayAsset.ai_suggested_connections).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-2 border-t border-line pt-3">
        <button
          className="rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90"
          onClick={handleConfirm}
          type="button"
        >
          {editing ? "编辑后入库" : "确认入库"}
        </button>
        {!editing && (
          <button
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
            onClick={() => setEditing(true)}
            type="button"
          >
            编辑
          </button>
        )}
        {editing && (
          <button
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
            onClick={() => { setEditing(false); setEditedAsset(cloneAsset(asset)); }}
            type="button"
          >
            取消编辑
          </button>
        )}
        <button
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
          onClick={onDiscard}
          type="button"
        >
          放弃
        </button>
      </div>
    </div>
  );
}
