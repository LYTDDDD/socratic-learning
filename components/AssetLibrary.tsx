"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CognitiveAsset, ConnectionLayer, AssetVersion } from "../lib/extract-asset";
import { loadAssets, deleteAsset, minorEditAsset, createAssetVersion } from "../lib/asset-store";
import {
  archiveKnowledgeSubCard,
  buildTemplateForAsset,
  createKnowledgeSubCard,
  loadKnowledgeSubCards,
  saveKnowledgeSubCard,
  suggestSubCardDrafts,
  type KnowledgeSubCard,
  type KnowledgeSubCardDraft,
} from "../lib/knowledge-subcard";
import { loadReviewRecords } from "../lib/review-record-store";
import type { ReviewRecord } from "../lib/review-record-store";
import { useAssetReview } from "../lib/use-asset-review";
import { formatTime, typeBadgeColor, maturityBadge, statusBadge } from "../lib/ui-utils";
import { getMissionById } from "../lib/mission-store";
import { AssetReviewHistory } from "./AssetReviewHistory";
import { AssetReviewFlowView } from "./AssetReviewFlowView";

const ASSET_TYPES = ["All", "MethodCard", "MisconceptionCard", "ReflectionCard", "ConceptCard", "CaseCard"] as const;

type AssetLibraryProps = {
  refreshKey: number;
  onNavigateToHistory?: (sourceRunId: string) => void;
  onAssetsChanged?: () => void;
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function hasAnyConnection(connectionLayer: ConnectionLayer): boolean {
  return Object.values(connectionLayer).some((items) => items.length > 0);
}

function flattenConnectionLayer(connectionLayer: ConnectionLayer): string[] {
  return Object.values(connectionLayer).flat();
}

function countConnectionItems(connectionLayer: ConnectionLayer): number {
  return flattenConnectionLayer(connectionLayer).length;
}

function countSavedSubCards(assetId: string): number {
  return loadKnowledgeSubCards(assetId).filter((card) => card.status === "saved").length;
}

function SubCardReviewModal({
  assets,
  onClose,
  onViewMotherCard,
}: {
  assets: CognitiveAsset[];
  onClose: () => void;
  onViewMotherCard: (assetId: string) => void;
}) {
  const allSubCards = useMemo(() => {
    const cards: KnowledgeSubCard[] = [];
    for (const asset of assets) {
      cards.push(...loadKnowledgeSubCards(asset.asset_id));
    }
    return cards.filter((c) => c.status === "saved");
  }, [assets]);

  const pickRandom = useCallback(
    (excludeId?: string): KnowledgeSubCard | null => {
      if (allSubCards.length === 0) return null;
      if (allSubCards.length === 1) return allSubCards[0];
      const candidates = excludeId
        ? allSubCards.filter((c) => c.id !== excludeId)
        : allSubCards;
      const idx = Math.floor(Math.random() * candidates.length);
      return candidates[idx];
    },
    [allSubCards],
  );

  const [current, setCurrent] = useState<KnowledgeSubCard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [recall, setRecall] = useState("");

  useEffect(() => {
    if (!current && allSubCards.length > 0) {
      setCurrent(pickRandom());
    }
  }, [current, allSubCards.length, pickRandom]);

  function handleNext() {
    setCurrent(pickRandom(current?.id));
    setRevealed(false);
    setRecall("");
  }

  if (allSubCards.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
        <div
          className="w-full max-w-md rounded-lg border border-line bg-surface-1 p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-4 text-sm text-ink-muted">暂无已保存的子卡可供复习。</p>
          <button
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-2"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const motherAsset = assets.find((a) => a.asset_id === current.parentAssetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-surface-1 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="text-sm font-semibold text-ink">子卡复习</h3>
            <span className="text-xs text-ink-muted/70">{allSubCards.length} 张可复习</span>
          </div>
          <button
            className="rounded p-1 text-ink-muted/50 transition hover:bg-surface-2 hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-line bg-surface-1 p-4">
          <h4 className="text-base font-semibold text-ink">{current.title}</h4>
          {current.triggerSignal && !revealed && (
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-medium text-ink-muted">触发信号：</span>
              {current.triggerSignal}
            </p>
          )}
          {!revealed && (
            <p className="mt-2 text-xs text-ink-muted/70">先回忆这张子卡的核心观点，写在下方</p>
          )}
        </div>

        {!revealed && (
          <div className="mb-4">
            <textarea
              className="w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
              onChange={(e) => setRecall(e.target.value)}
              placeholder="写下你回忆的核心观点和适用场景..."
              rows={4}
              value={recall}
            />
          </div>
        )}

        {revealed && (
          <div className="mb-4">
            {recall.trim() && (
              <div className="mb-3 rounded-md border border-blue/30 bg-blue/5 p-3">
                <dt className="text-xs font-medium text-ink-muted">你的回忆</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{recall}</dd>
              </div>
            )}
            <div className="rounded-md border border-line bg-surface-1 p-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-ink">
                {current.markdownContent}
              </pre>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          {!revealed ? (
            <button
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue/90"
              onClick={() => setRevealed(true)}
              type="button"
            >
              显示答案
            </button>
          ) : (
            <button
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue/90"
              onClick={handleNext}
              type="button"
            >
              换一张
            </button>
          )}
          {motherAsset && (
            <button
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-2"
              onClick={() => onViewMotherCard(current.parentAssetId)}
              type="button"
            >
              查看母卡
            </button>
          )}
          <span className="ml-auto text-xs text-ink-muted/50">
            {allSubCards.findIndex((c) => c.id === current.id) + 1} / {allSubCards.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function AssetDetail({ asset, onClose, onNavigateToHistory, onAssetUpdated }: { asset: CognitiveAsset; onClose: () => void; onNavigateToHistory?: (sourceRunId: string) => void; onAssetUpdated?: () => void }) {
  const [liveAsset, setLiveAsset] = useState<CognitiveAsset>(asset);
  const specialEntries = Object.entries(liveAsset.special_fields);
  const [showAiConnections, setShowAiConnections] = useState(false);
  const [subCards, setSubCards] = useState<KnowledgeSubCard[]>([]);
  const [editingSubCard, setEditingSubCard] = useState<KnowledgeSubCard | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [draftSource, setDraftSource] = useState<KnowledgeSubCard["source"]>("user_created");

  useEffect(() => {
    setSubCards(loadKnowledgeSubCards(liveAsset.asset_id));
  }, [liveAsset.asset_id]);
  const suggestedSubCards = suggestSubCardDrafts(liveAsset);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(liveAsset.title);
  const [editCoreInsight, setEditCoreInsight] = useState(liveAsset.core_insight);
  const [editOriginalJudgment, setEditOriginalJudgment] = useState(liveAsset.original_judgment);
  const [editRevisedJudgment, setEditRevisedJudgment] = useState(liveAsset.revised_judgment);
  const [editMyUnderstanding, setEditMyUnderstanding] = useState(liveAsset.my_understanding);
  const [editTransferableValue, setEditTransferableValue] = useState(liveAsset.transferable_value);
  const [editMode, setEditMode] = useState<"minor" | "version">("minor");
  const [changeReason, setChangeReason] = useState("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const connectionCount = countConnectionItems(liveAsset.connection_layer);
  const aiConnectionCount = countConnectionItems(liveAsset.ai_suggested_connections);
  const savedSubCardCount = subCards.filter((card) => card.status === "saved").length;
  const reviewQuestionCount =
    liveAsset.review_questions.length +
    liveAsset.connection_questions.length +
    liveAsset.application_questions.length;

  const refreshReviewRecords = useCallback(() => {
    setReviewRecords(loadReviewRecords(liveAsset.asset_id));
    onAssetUpdated?.();
  }, [liveAsset.asset_id, onAssetUpdated]);

  const { reviewFlow: reviewState, startReview: hookStartReview, updateAnswer: updateReviewAnswer, submitAnswers: submitReviewAnswers, exitReview } = useAssetReview(refreshReviewRecords);

  useEffect(() => {
    setReviewRecords(loadReviewRecords(liveAsset.asset_id));
  }, [liveAsset.asset_id]);

  function startReview() {
    hookStartReview(liveAsset);
  }

  function refreshSubCards() {
    setSubCards(loadKnowledgeSubCards(liveAsset.asset_id));
  }

  function startNewSubCard(markdown = buildTemplateForAsset(liveAsset), title = `${liveAsset.title || "未命名资产"} 子卡`) {
    setEditingSubCard(null);
    setDraftTitle(title);
    setDraftMarkdown(markdown);
    setDraftSource("user_created");
  }

  function startSuggestedSubCard(draft: KnowledgeSubCardDraft) {
    setEditingSubCard(null);
    setDraftTitle(draft.title);
    setDraftMarkdown(draft.markdownContent);
    setDraftSource("ai_suggested_user_edited");
  }

  function editSubCard(card: KnowledgeSubCard) {
    setEditingSubCard(card);
    setDraftTitle(card.title);
    setDraftMarkdown(card.markdownContent);
    setDraftSource(card.source);
  }

  function clearSubCardEditor() {
    setEditingSubCard(null);
    setDraftTitle("");
    setDraftMarkdown("");
    setDraftSource("user_created");
  }

  function saveSubCardDraft() {
    if (!draftTitle.trim() && !draftMarkdown.trim()) return;

    const card = editingSubCard
      ? {
          ...editingSubCard,
          title: draftTitle.trim() || "未命名子卡",
          markdownContent: draftMarkdown.trim(),
          source: draftSource,
        }
      : createKnowledgeSubCard({
          parentAssetId: asset.asset_id,
          title: draftTitle,
          markdownContent: draftMarkdown,
          source: draftSource,
        });

    saveKnowledgeSubCard(card);
    refreshSubCards();
    onAssetUpdated?.();
    clearSubCardEditor();
  }

  function archiveSubCard(cardId: string) {
    if (!window.confirm("确认归档这张子卡？")) return;
    archiveKnowledgeSubCard(cardId);
    refreshSubCards();
    onAssetUpdated?.();
    if (editingSubCard?.id === cardId) clearSubCardEditor();
  }

  async function copySubCard(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {}
  }

  function startEditing() {
    setEditTitle(liveAsset.title);
    setEditCoreInsight(liveAsset.core_insight);
    setEditOriginalJudgment(liveAsset.original_judgment);
    setEditRevisedJudgment(liveAsset.revised_judgment);
    setEditMyUnderstanding(liveAsset.my_understanding);
    setEditTransferableValue(liveAsset.transferable_value);
    setEditMode("minor");
    setChangeReason("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function saveEdit() {
    const updates: Partial<CognitiveAsset> = {
      title: editTitle,
      core_insight: editCoreInsight,
      original_judgment: editOriginalJudgment,
      revised_judgment: editRevisedJudgment,
      my_understanding: editMyUnderstanding,
      transferable_value: editTransferableValue,
    };

    let updated: CognitiveAsset;
    if (editMode === "version") {
      if (!changeReason.trim()) return;
      updated = createAssetVersion(liveAsset, updates, changeReason.trim());
    } else {
      updated = minorEditAsset(liveAsset, updates);
    }

    setLiveAsset(updated);
    setIsEditing(false);
    onAssetUpdated?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-surface-1 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${typeBadgeColor(liveAsset.asset_type)}`}>
              {liveAsset.asset_type}
            </span>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${maturityBadge(liveAsset.maturity)}`}>
              {liveAsset.maturity}
            </span>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadge(liveAsset.status)}`}>
              {liveAsset.status === "confirmed" ? "已确认" : "草稿"}
            </span>
            {liveAsset.versions.length > 0 && (
              <span className="inline-block rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">
                v{liveAsset.versions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {liveAsset.status === "confirmed" && !isEditing && !reviewState && (
              <>
                <button
                  className="rounded border border-blue/40 bg-blue/5 px-3 py-1 text-xs font-medium text-blue transition hover:bg-blue/10"
                  onClick={startReview}
                  type="button"
                >
                  Review
                </button>
                <button
                  className="rounded border border-line px-3 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                  onClick={startEditing}
                  type="button"
                >
                  编辑
                </button>
              </>
            )}
            <button
              className="rounded p-1 text-ink-muted/50 transition hover:bg-surface-2 hover:text-ink"
              onClick={onClose}
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Mother Card</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{liveAsset.title || "未命名资产"}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-line bg-surface-1 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{reviewQuestionCount}</p>
              <p className="text-[10px] text-ink-muted">Review Prompts</p>
            </div>
            <div className="rounded-md border border-line bg-surface-1 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{connectionCount}</p>
              <p className="text-[10px] text-ink-muted">User Connections</p>
            </div>
            <div className="rounded-md border border-line bg-surface-1 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{aiConnectionCount}</p>
              <p className="text-[10px] text-ink-muted">AI Candidates</p>
            </div>
            <div className="rounded-md border border-line bg-surface-1 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{savedSubCardCount}</p>
              <p className="text-[10px] text-ink-muted">SubCards</p>
            </div>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3 rounded-lg border border-blue/30 bg-blue/5 p-4">
            <div className="mb-3 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <input checked={editMode === "minor"} name="editMode" onChange={() => setEditMode("minor")} type="radio" />
                小编辑
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <input checked={editMode === "version"} name="editMode" onChange={() => setEditMode("version")} type="radio" />
                创建新版本
              </label>
            </div>
            {editMode === "minor" && (
              <p className="text-xs text-ink-muted/70">小编辑直接修改当前资产，不生成新版本。适用于错别字、表达优化等。</p>
            )}
            {editMode === "version" && (
              <div>
                <dt className="text-xs font-medium text-ink-muted">变更原因</dt>
                <textarea
                  className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="为什么需要新版本？判断发生了什么变化？"
                  rows={2}
                  value={changeReason}
                />
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-ink-muted">标题</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                onChange={(e) => setEditTitle(e.target.value)}
                rows={1}
                value={editTitle}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">核心洞察</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                onChange={(e) => setEditCoreInsight(e.target.value)}
                rows={2}
                value={editCoreInsight}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">原始判断</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                onChange={(e) => setEditOriginalJudgment(e.target.value)}
                rows={2}
                value={editOriginalJudgment}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">修正后判断</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                onChange={(e) => setEditRevisedJudgment(e.target.value)}
                rows={2}
                value={editRevisedJudgment}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">我的理解</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                onChange={(e) => setEditMyUnderstanding(e.target.value)}
                rows={2}
                value={editMyUnderstanding}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">可迁移价值</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-1 focus:ring-blue/20"
                onChange={(e) => setEditTransferableValue(e.target.value)}
                rows={2}
                value={editTransferableValue}
              />
            </div>
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <button
                className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue/90 disabled:opacity-50"
                disabled={editMode === "version" && !changeReason.trim()}
                onClick={saveEdit}
                type="button"
              >
                {editMode === "version" ? "保存为新版本" : "保存小编辑"}
              </button>
              <button
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-2"
                onClick={cancelEditing}
                type="button"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        <dl className="grid gap-3">
          <div>
            <dt className="text-xs font-medium text-ink-muted">核心洞察</dt>
            <dd className="mt-0.5 text-sm text-ink">{liveAsset.core_insight || "—"}</dd>
          </div>
          {liveAsset.ai_generated_summary && (
            <div>
              <dt className="text-xs font-medium text-ink-muted">AI 原始总结</dt>
              <dd className="mt-0.5 text-sm text-ink">{liveAsset.ai_generated_summary}</dd>
            </div>
          )}
          {(liveAsset.my_understanding || liveAsset.problem_it_solves || liveAsset.my_judgment) && (
            <div className="rounded border border-line bg-surface-1 px-3 py-2">
              {liveAsset.my_understanding && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink-muted">我的理解</dt>
                  <dd className="mt-0.5 text-sm text-ink">{liveAsset.my_understanding}</dd>
                </div>
              )}
              {liveAsset.problem_it_solves && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink-muted">它解决什么问题</dt>
                  <dd className="mt-0.5 text-sm text-ink">{liveAsset.problem_it_solves}</dd>
                </div>
              )}
              {liveAsset.my_judgment && (
                <div>
                  <dt className="text-xs font-medium text-ink-muted">我的判断</dt>
                  <dd className="mt-0.5 text-sm text-ink">{liveAsset.my_judgment}</dd>
                </div>
              )}
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-ink-muted">原始判断</dt>
            <dd className="mt-0.5 text-sm text-amber">{liveAsset.original_judgment || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">修正后判断</dt>
            <dd className="mt-0.5 text-sm text-blue">{liveAsset.revised_judgment || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">可迁移价值</dt>
            <dd className="mt-0.5 text-sm text-ink">{liveAsset.transferable_value || "—"}</dd>
          </div>
          {liveAsset.review_questions.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-muted">复习问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.review_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {liveAsset.connection_questions.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-muted">连接问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.connection_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {liveAsset.application_questions.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-muted">应用问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.application_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-ink-muted">来源任务</dt>
            <dd className="mt-0.5 text-sm text-ink">{
              liveAsset.source_mission
                ? (getMissionById(liveAsset.source_mission)?.title ?? liveAsset.source_mission)
                : "—"
            }</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">置信度</dt>
            <dd className="mt-0.5 text-sm text-ink">{liveAsset.confidence}</dd>
          </div>
          {specialEntries.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-muted">专属字段</dt>
              <dd className="mt-1">
                <dl className="grid gap-2">
                  {specialEntries.map(([key, value]) => (
                    <div key={key} className="rounded border border-line bg-surface-1 px-3 py-2">
                      <dt className="text-xs font-medium text-ink-muted">{key}</dt>
                      <dd className="mt-0.5 text-sm text-ink">
                        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </dd>
            </div>
          )}
          {(() => {
            const cl = liveAsset.connection_layer;
            const aiCl = liveAsset.ai_suggested_connections;
            const clEntries: [string, string, string[], string[]][] = [
              ["related_concepts", "相关概念", cl.related_concepts, aiCl.related_concepts],
              ["related_assets", "相关资产", cl.related_assets, aiCl.related_assets],
              ["mental_models", "相关思维模型", cl.mental_models, aiCl.mental_models],
              ["prior_experience", "相关个人经验", cl.prior_experience, aiCl.prior_experience],
              ["opposite_cases", "反面案例", cl.opposite_cases, aiCl.opposite_cases],
              ["application_scenarios", "应用场景", cl.application_scenarios, aiCl.application_scenarios],
              ["open_questions", "未解决问题", cl.open_questions, aiCl.open_questions],
            ];
            const hasAny = clEntries.some(([, , items]) => items.length > 0);
            const hasAiSuggestions = clEntries.some(([, , , aiItems]) => aiItems.length > 0);
            return hasAny || hasAiSuggestions ? (
              <div className="border-t border-line pt-3">
                <div className="mb-2 flex items-center gap-2">
                  <dt className="text-xs font-semibold text-ink-muted">User-first Connection Layer</dt>
                  {hasAiSuggestions && (
                    <button
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                      onClick={() => setShowAiConnections((v) => !v)}
                      type="button"
                    >
                      {showAiConnections ? "隐藏 AI 候选连接" : "显示 AI 候选连接"}
                    </button>
                  )}
                </div>
                <dd>
                  <dl className="grid grid-cols-2 gap-2">
                    {clEntries.map(([key, label, items, aiItems]) => {
                      const hasItems = items.length > 0;
                      const hasAi = showAiConnections && aiItems.length > 0;
                      if (!hasItems && !hasAi) return null;
                      return (
                        <div key={key} className="rounded border border-line bg-surface-1 px-3 py-2">
                          <dt className="text-xs font-medium text-ink-muted">{label}</dt>
                          {hasItems && (
                            <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-sm text-ink">
                              {items.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          )}
                          {hasAi && (
                            <div className="mt-1 border-t border-dashed border-line pt-1">
                              <span className="text-[10px] font-medium text-blue-500">AI 建议</span>
                              <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-ink-muted">
                                {aiItems.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </dd>
              </div>
            ) : null;
          })()}
          {liveAsset.usage_evidence.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink-muted">使用证据</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.usage_evidence.map((item) => (
                  <li key={item.id}>{item.scenario || item.action || item.result}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-ink-muted">来源 Run ID</dt>
            <dd className="mt-0.5">
              {onNavigateToHistory ? (
                <button
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                  onClick={() => onNavigateToHistory(liveAsset.source_run_id)}
                  type="button"
                >
                  {liveAsset.source_run_id}
                </button>
              ) : (
                <code className="text-xs text-ink-muted">{liveAsset.source_run_id}</code>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">创建时间</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatTime(liveAsset.created_at)}</dd>
          </div>
          {liveAsset.versions.length > 1 && (
            <div className="border-t border-line pt-3">
              <button
                className="flex items-center gap-1 text-xs font-medium text-ink-muted transition hover:text-ink"
                onClick={() => setShowVersionHistory((v) => !v)}
                type="button"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showVersionHistory ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                版本历史（{liveAsset.versions.length} 个版本）
              </button>
              {showVersionHistory && (
                <div className="mt-2 space-y-2">
                  {[...liveAsset.versions].reverse().map((v) => (
                    <div
                      key={v.id}
                      className={`rounded border px-3 py-2 text-sm ${
                        v.id === liveAsset.current_version_id
                          ? "border-blue/40 bg-blue/5"
                          : "border-line bg-surface-1/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink-muted">v{v.versionNumber}</span>
                        <span className="text-[10px] text-ink-muted/70">{formatTime(v.createdAt)}</span>
                      </div>
                      {v.changeReason && (
                        <p className="mt-0.5 text-xs text-ink-muted">{v.changeReason}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-muted line-clamp-2">{v.coreInsight}</p>
                      {v.id === liveAsset.current_version_id && (
                        <span className="mt-1 inline-block rounded bg-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-blue">
                          当前版本
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {reviewState && (
            <AssetReviewFlowView
              className="border-t border-line pt-4"
              exitLabel="退出 Review"
              onAnswerChange={updateReviewAnswer}
              onExit={exitReview}
              onRetry={startReview}
              onSubmit={submitReviewAnswers}
              reviewFlow={reviewState}
              title="AI 评估（Review Mode）"
            />
          )}
          <AssetReviewHistory records={reviewRecords} />
          <div className="border-t border-line pt-4">
            <dt className="mb-2 text-xs font-semibold text-ink-muted">Knowledge SubCards</dt>
            <dd className="space-y-3">
              {subCards.length === 0 ? (
                <p className="text-sm text-ink-muted">暂无子卡</p>
              ) : (
                <ul className="space-y-2">
                  {subCards.map((card) => (
                    <li key={card.id} className="rounded border border-line bg-surface-1 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-ink">{card.title}</h4>
                          <p className="mt-1 text-xs text-ink-muted">
                            {card.source === "ai_suggested_user_edited" ? "AI 建议后用户编辑" : "用户创建"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:bg-surface-2" onClick={() => copySubCard(card.markdownContent)} type="button">
                            复制
                          </button>
                          <button className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:bg-surface-2" onClick={() => editSubCard(card)} type="button">
                            编辑
                          </button>
                          <button className="rounded border border-line px-2 py-1 text-xs text-amber hover:bg-red-50" onClick={() => archiveSubCard(card.id)} type="button">
                            归档
                          </button>
                        </div>
                      </div>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-surface-1 p-2 text-xs leading-5 text-ink-muted">
                        {card.markdownContent}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded border border-line bg-surface-1 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button className="rounded bg-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue/90" onClick={() => startNewSubCard()} type="button">
                    新建子卡
                  </button>
                  <button className="rounded border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-2" onClick={() => startNewSubCard(buildTemplateForAsset(asset))} type="button">
                    插入默认模板
                  </button>
                </div>

                {suggestedSubCards.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-ink-muted">建议拆分主题</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedSubCards.map((draft) => (
                        <button
                          className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:bg-surface-2"
                          key={draft.title}
                          onClick={() => startSuggestedSubCard(draft)}
                          type="button"
                        >
                          {draft.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(draftTitle || draftMarkdown) && (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded border border-line px-2 py-1.5 text-sm outline-none focus:border-blue"
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="子卡标题"
                      value={draftTitle}
                    />
                    <textarea
                      className="min-h-56 w-full rounded border border-line px-2 py-1.5 font-mono text-xs leading-5 outline-none focus:border-blue"
                      onChange={(e) => setDraftMarkdown(e.target.value)}
                      placeholder="使用 Markdown 写下核心观点、案例和应用场景"
                      value={draftMarkdown}
                    />
                    <div className="flex gap-2">
                      <button className="rounded bg-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue/90" onClick={saveSubCardDraft} type="button">
                        保存子卡
                      </button>
                      <button className="rounded border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-2" onClick={clearSubCardEditor} type="button">
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function AssetLibrary({ refreshKey, onNavigateToHistory, onAssetsChanged }: AssetLibraryProps) {
  const [assets, setAssets] = useState<CognitiveAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const hasSubCards = useMemo(() => {
    return assets.some((a) => loadKnowledgeSubCards(a.asset_id).some((c) => c.status === "saved"));
  }, [assets]);

  const libraryStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        const subCards = countSavedSubCards(asset.asset_id);
        const connectionItems = countConnectionItems(asset.connection_layer);
        return {
          motherCards: stats.motherCards + (asset.status === "confirmed" ? 1 : 0),
          drafts: stats.drafts + (asset.status === "draft" ? 1 : 0),
          subCards: stats.subCards + subCards,
          connections: stats.connections + connectionItems,
          reviewReady: stats.reviewReady + (asset.status === "confirmed" && (asset.review_questions.length > 0 || subCards > 0) ? 1 : 0),
        };
      },
      { motherCards: 0, drafts: 0, subCards: 0, connections: 0, reviewReady: 0 },
    );
  }, [assets]);

  useEffect(() => {
    setAssets(loadAssets());
  }, [refreshKey]);

  const filtered = useMemo(() => assets.filter((a) => {
    if (typeFilter !== "All" && a.asset_type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(lower) ||
        a.core_insight.toLowerCase().includes(lower)
      );
    }
    return true;
  }), [assets, typeFilter, searchQuery]);

  function handleDelete(asset: CognitiveAsset) {
    const title = asset.title || asset.asset_id;
    if (!window.confirm(`确认删除资产「${title}」？此操作无法撤销。`)) return;
    const assetId = asset.asset_id;
    deleteAsset(assetId);
    setAssets(loadAssets());
    onAssetsChanged?.();
    if (expandedId === assetId) setExpandedId(null);
  }

  const expandedAsset = expandedId ? assets.find((a) => a.asset_id === expandedId) : null;

  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Asset Library</p>
          <h3 className="mt-1 text-sm font-semibold text-ink">资产库</h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Mother Card 是主资产；Knowledge SubCard 用于拆分复习和调用。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              hasSubCards
                ? "text-blue hover:bg-blue/10"
                : "cursor-not-allowed text-ink-muted/50"
            }`}
            disabled={!hasSubCards}
            onClick={() => setShowReview(true)}
            title={hasSubCards ? "随机复习一张子卡" : "暂无子卡可复习"}
            type="button"
          >
            子卡复习
          </button>
          <button
            className="rounded px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            onClick={() => setCollapsed((c) => !c)}
            type="button"
          >
            {collapsed ? "展开" : "收起"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{libraryStats.motherCards}</p>
              <p className="text-[10px] text-ink-muted">Mother Cards</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{libraryStats.subCards}</p>
              <p className="text-[10px] text-ink-muted">SubCards</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{libraryStats.connections}</p>
              <p className="text-[10px] text-ink-muted">Connections</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
              <p className="text-sm font-semibold text-ink">{libraryStats.reviewReady}</p>
              <p className="text-[10px] text-ink-muted">Review Ready</p>
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-1 px-3 py-1.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题或核心洞察..."
              type="text"
              value={searchQuery}
            />
            <select
              className="shrink-0 rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink outline-none transition focus:border-blue"
              onChange={(e) => setTypeFilter(e.target.value)}
              value={typeFilter}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "All" ? "全部类型" : t}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {assets.length === 0 ? "暂无 Mother Card。确认资产候选后会出现在这里。" : "无匹配资产"}
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((asset) => (
                <li
                  className="group flex items-start gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 transition hover:border-blue/40 hover:shadow-sm"
                  key={asset.asset_id}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(asset.asset_id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block shrink-0 rounded bg-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-blue">
                        Mother Card
                      </span>
                      <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeColor(asset.asset_type)}`}>
                        {asset.asset_type}
                      </span>
                      <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${maturityBadge(asset.maturity)}`}>
                        {asset.maturity}
                      </span>
                      <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(asset.status)}`}>
                        {asset.status === "confirmed" ? "已确认" : "草稿"}
                      </span>
                      <span className="truncate text-sm font-medium text-ink">
                        {asset.title || "未命名"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      {truncate(asset.core_insight, 60)}
                      <span className="ml-2">{formatTime(asset.created_at)}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-ink-muted/70">
                      连接 {countConnectionItems(asset.connection_layer)} · 子卡 {countSavedSubCards(asset.asset_id)} · 复习题 {asset.review_questions.length}
                    </div>
                  </button>
                  <button
                    className="shrink-0 rounded p-1 text-ink-muted/50 transition hover:bg-red-50 hover:text-amber"
                    onClick={() => handleDelete(asset)}
                    title="删除"
                    type="button"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {expandedAsset && (
        <AssetDetail asset={expandedAsset} onClose={() => setExpandedId(null)} onNavigateToHistory={onNavigateToHistory} onAssetUpdated={() => {
          setAssets(loadAssets());
          onAssetsChanged?.();
        }} />
      )}

      {showReview && (
        <SubCardReviewModal
          assets={assets}
          onClose={() => setShowReview(false)}
          onViewMotherCard={(assetId) => {
            setShowReview(false);
            setExpandedId(assetId);
          }}
        />
      )}
    </div>
  );
}
