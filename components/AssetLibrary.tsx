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
          className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-4 text-sm text-ink/60">暂无已保存的子卡可供复习。</p>
          <button
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
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
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="text-sm font-semibold text-ink">子卡复习</h3>
            <span className="text-xs text-ink/40">{allSubCards.length} 张可复习</span>
          </div>
          <button
            className="rounded p-1 text-ink/30 transition hover:bg-paper hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-line bg-paper/60 p-4">
          <h4 className="text-base font-semibold text-ink">{current.title}</h4>
          {current.triggerSignal && !revealed && (
            <p className="mt-2 text-sm text-ink/60">
              <span className="font-medium text-ink/70">触发信号：</span>
              {current.triggerSignal}
            </p>
          )}
          {!revealed && (
            <p className="mt-2 text-xs text-ink/40">先回忆这张子卡的核心观点，写在下方</p>
          )}
        </div>

        {!revealed && (
          <div className="mb-4">
            <textarea
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
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
              <div className="mb-3 rounded-md border border-moss/30 bg-moss/5 p-3">
                <dt className="text-xs font-medium text-ink/60">你的回忆</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{recall}</dd>
              </div>
            )}
            <div className="rounded-md border border-line bg-white p-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-ink">
                {current.markdownContent}
              </pre>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          {!revealed ? (
            <button
              className="rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90"
              onClick={() => setRevealed(true)}
              type="button"
            >
              显示答案
            </button>
          ) : (
            <button
              className="rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90"
              onClick={handleNext}
              type="button"
            >
              换一张
            </button>
          )}
          {motherAsset && (
            <button
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
              onClick={() => onViewMotherCard(current.parentAssetId)}
              type="button"
            >
              查看母卡
            </button>
          )}
          <span className="ml-auto text-xs text-ink/30">
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
  const [showReviewHistory, setShowReviewHistory] = useState(false);

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
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white p-6 shadow-lg"
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
              <span className="inline-block rounded bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink/60">
                v{liveAsset.versions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {liveAsset.status === "confirmed" && !isEditing && !reviewState && (
              <>
                <button
                  className="rounded border border-moss/40 bg-moss/5 px-3 py-1 text-xs font-medium text-moss transition hover:bg-moss/10"
                  onClick={startReview}
                  type="button"
                >
                  Review
                </button>
                <button
                  className="rounded border border-line px-3 py-1 text-xs font-medium text-ink/60 transition hover:bg-paper hover:text-ink"
                  onClick={startEditing}
                  type="button"
                >
                  编辑
                </button>
              </>
            )}
            <button
              className="rounded p-1 text-ink/30 transition hover:bg-paper hover:text-ink"
              onClick={onClose}
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <h3 className="mb-4 text-lg font-semibold text-ink">{liveAsset.title || "未命名资产"}</h3>

        {isEditing ? (
          <div className="space-y-3 rounded-lg border border-moss/30 bg-moss/5 p-4">
            <div className="mb-3 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
                <input checked={editMode === "minor"} name="editMode" onChange={() => setEditMode("minor")} type="radio" />
                小编辑
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
                <input checked={editMode === "version"} name="editMode" onChange={() => setEditMode("version")} type="radio" />
                创建新版本
              </label>
            </div>
            {editMode === "minor" && (
              <p className="text-xs text-ink/40">小编辑直接修改当前资产，不生成新版本。适用于错别字、表达优化等。</p>
            )}
            {editMode === "version" && (
              <div>
                <dt className="text-xs font-medium text-ink/60">变更原因</dt>
                <textarea
                  className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="为什么需要新版本？判断发生了什么变化？"
                  rows={2}
                  value={changeReason}
                />
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-ink/60">标题</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => setEditTitle(e.target.value)}
                rows={1}
                value={editTitle}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/60">核心洞察</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => setEditCoreInsight(e.target.value)}
                rows={2}
                value={editCoreInsight}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/60">原始判断</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => setEditOriginalJudgment(e.target.value)}
                rows={2}
                value={editOriginalJudgment}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/60">修正后判断</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => setEditRevisedJudgment(e.target.value)}
                rows={2}
                value={editRevisedJudgment}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/60">我的理解</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => setEditMyUnderstanding(e.target.value)}
                rows={2}
                value={editMyUnderstanding}
              />
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/60">可迁移价值</dt>
              <textarea
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(e) => setEditTransferableValue(e.target.value)}
                rows={2}
                value={editTransferableValue}
              />
            </div>
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <button
                className="rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
                disabled={editMode === "version" && !changeReason.trim()}
                onClick={saveEdit}
                type="button"
              >
                {editMode === "version" ? "保存为新版本" : "保存小编辑"}
              </button>
              <button
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
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
            <dt className="text-xs font-medium text-ink/60">核心洞察</dt>
            <dd className="mt-0.5 text-sm text-ink">{liveAsset.core_insight || "—"}</dd>
          </div>
          {liveAsset.ai_generated_summary && (
            <div>
              <dt className="text-xs font-medium text-ink/60">AI 原始总结</dt>
              <dd className="mt-0.5 text-sm text-ink">{liveAsset.ai_generated_summary}</dd>
            </div>
          )}
          {(liveAsset.my_understanding || liveAsset.problem_it_solves || liveAsset.my_judgment) && (
            <div className="rounded border border-line bg-paper/60 px-3 py-2">
              {liveAsset.my_understanding && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">我的理解</dt>
                  <dd className="mt-0.5 text-sm text-ink">{liveAsset.my_understanding}</dd>
                </div>
              )}
              {liveAsset.problem_it_solves && (
                <div className="mb-2">
                  <dt className="text-xs font-medium text-ink/60">它解决什么问题</dt>
                  <dd className="mt-0.5 text-sm text-ink">{liveAsset.problem_it_solves}</dd>
                </div>
              )}
              {liveAsset.my_judgment && (
                <div>
                  <dt className="text-xs font-medium text-ink/60">我的判断</dt>
                  <dd className="mt-0.5 text-sm text-ink">{liveAsset.my_judgment}</dd>
                </div>
              )}
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-ink/60">原始判断</dt>
            <dd className="mt-0.5 text-sm text-rust">{liveAsset.original_judgment || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink/60">修正后判断</dt>
            <dd className="mt-0.5 text-sm text-moss">{liveAsset.revised_judgment || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink/60">可迁移价值</dt>
            <dd className="mt-0.5 text-sm text-ink">{liveAsset.transferable_value || "—"}</dd>
          </div>
          {liveAsset.review_questions.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink/60">复习问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.review_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {liveAsset.connection_questions.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink/60">连接问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.connection_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {liveAsset.application_questions.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink/60">应用问题</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.application_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-ink/60">来源任务</dt>
            <dd className="mt-0.5 text-sm text-ink">{
              liveAsset.source_mission
                ? (getMissionById(liveAsset.source_mission)?.title ?? liveAsset.source_mission)
                : "—"
            }</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink/60">置信度</dt>
            <dd className="mt-0.5 text-sm text-ink">{liveAsset.confidence}</dd>
          </div>
          {specialEntries.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-ink/60">专属字段</dt>
              <dd className="mt-1">
                <dl className="grid gap-2">
                  {specialEntries.map(([key, value]) => (
                    <div key={key} className="rounded border border-line bg-paper/60 px-3 py-2">
                      <dt className="text-xs font-medium text-ink/60">{key}</dt>
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
                  <dt className="text-xs font-semibold text-ink/70">连接层</dt>
                  {hasAiSuggestions && (
                    <button
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:bg-paper hover:text-ink"
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
                        <div key={key} className="rounded border border-line bg-paper/60 px-3 py-2">
                          <dt className="text-xs font-medium text-ink/60">{label}</dt>
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
                              <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-ink/50">
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
              <dt className="text-xs font-medium text-ink/60">使用证据</dt>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink">
                {liveAsset.usage_evidence.map((item) => (
                  <li key={item.id}>{item.scenario || item.action || item.result}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-ink/60">来源 Run ID</dt>
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
                <code className="text-xs text-ink/70">{liveAsset.source_run_id}</code>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink/60">创建时间</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatTime(liveAsset.created_at)}</dd>
          </div>
          {liveAsset.versions.length > 1 && (
            <div className="border-t border-line pt-3">
              <button
                className="flex items-center gap-1 text-xs font-medium text-ink/60 transition hover:text-ink"
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
                          ? "border-moss/40 bg-moss/5"
                          : "border-line bg-paper/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink/70">v{v.versionNumber}</span>
                        <span className="text-[10px] text-ink/40">{formatTime(v.createdAt)}</span>
                      </div>
                      {v.changeReason && (
                        <p className="mt-0.5 text-xs text-ink/50">{v.changeReason}</p>
                      )}
                      <p className="mt-1 text-xs text-ink/60 line-clamp-2">{v.coreInsight}</p>
                      {v.id === liveAsset.current_version_id && (
                        <span className="mt-1 inline-block rounded bg-moss/10 px-1.5 py-0.5 text-[10px] font-medium text-moss">
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
          {reviewRecords.length > 0 && (
          <div className="border-t border-line pt-4">
            <div className="mb-2 flex items-center gap-2">
              <dt className="text-xs font-semibold text-ink/70">复习记录</dt>
              <button
                className="flex items-center gap-1 text-xs font-medium text-ink/50 transition hover:text-ink"
                onClick={() => setShowReviewHistory((v) => !v)}
                type="button"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showReviewHistory ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {reviewRecords.length} 次
              </button>
            </div>
            {showReviewHistory && (
              <dd className="space-y-2">
                {reviewRecords.map((record) => (
                  <div key={record.id} className="rounded border border-line bg-paper/60 px-3 py-2">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          record.result === "good" ? "bg-moss/15 text-moss" :
                          record.result === "partial" ? "bg-yellow-100 text-yellow-700" :
                          "bg-rust/10 text-rust"
                        }`}>
                          {record.result === "good" ? "理解到位" : record.result === "partial" ? "部分理解" : "需要补充"}
                        </span>
                        {record.maturityUpgradeSuggested && (
                          <span className="inline-block rounded bg-moss/10 px-1.5 py-0.5 text-[10px] font-medium text-moss">
                            建议升级
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-ink/40">{formatTime(record.reviewedAt)}</span>
                    </div>
                    <p className="text-xs text-ink/60 line-clamp-2">{record.overallAssessment || "—"}</p>
                    {record.feedback.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {record.feedback.map((f, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${
                              f.evaluation === "good" ? "bg-moss/10 text-moss" :
                              f.evaluation === "partial" ? "bg-yellow-50 text-yellow-600" :
                              "bg-rust/5 text-rust"
                            }`}>
                              {f.evaluation === "good" ? "✓" : f.evaluation === "partial" ? "◐" : "✗"}
                            </span>
                            <p className="text-[11px] leading-4 text-ink/50 line-clamp-1">{f.question}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </dd>
            )}
          </div>
          )}
          <div className="border-t border-line pt-4">
            <dt className="mb-2 text-xs font-semibold text-ink/70">知识子卡</dt>
            <dd className="space-y-3">
              {subCards.length === 0 ? (
                <p className="text-sm text-ink/50">暂无子卡</p>
              ) : (
                <ul className="space-y-2">
                  {subCards.map((card) => (
                    <li key={card.id} className="rounded border border-line bg-paper/60 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-ink">{card.title}</h4>
                          <p className="mt-1 text-xs text-ink/50">
                            {card.source === "ai_suggested_user_edited" ? "AI 建议后用户编辑" : "用户创建"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button className="rounded border border-line px-2 py-1 text-xs text-ink/60 hover:bg-white" onClick={() => copySubCard(card.markdownContent)} type="button">
                            复制
                          </button>
                          <button className="rounded border border-line px-2 py-1 text-xs text-ink/60 hover:bg-white" onClick={() => editSubCard(card)} type="button">
                            编辑
                          </button>
                          <button className="rounded border border-line px-2 py-1 text-xs text-rust hover:bg-red-50" onClick={() => archiveSubCard(card.id)} type="button">
                            归档
                          </button>
                        </div>
                      </div>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs leading-5 text-ink/70">
                        {card.markdownContent}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded border border-line bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button className="rounded bg-moss px-3 py-1.5 text-xs font-semibold text-white hover:bg-moss/90" onClick={() => startNewSubCard()} type="button">
                    新建子卡
                  </button>
                  <button className="rounded border border-line px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-paper" onClick={() => startNewSubCard(buildTemplateForAsset(asset))} type="button">
                    插入默认模板
                  </button>
                </div>

                {suggestedSubCards.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-ink/60">建议拆分主题</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedSubCards.map((draft) => (
                        <button
                          className="rounded border border-line px-2 py-1 text-xs text-ink/60 hover:bg-paper"
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
                      className="w-full rounded border border-line px-2 py-1.5 text-sm outline-none focus:border-moss"
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="子卡标题"
                      value={draftTitle}
                    />
                    <textarea
                      className="min-h-56 w-full rounded border border-line px-2 py-1.5 font-mono text-xs leading-5 outline-none focus:border-moss"
                      onChange={(e) => setDraftMarkdown(e.target.value)}
                      placeholder="使用 Markdown 写下核心观点、案例和应用场景"
                      value={draftMarkdown}
                    />
                    <div className="flex gap-2">
                      <button className="rounded bg-moss px-3 py-1.5 text-xs font-semibold text-white hover:bg-moss/90" onClick={saveSubCardDraft} type="button">
                        保存子卡
                      </button>
                      <button className="rounded border border-line px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-paper" onClick={clearSubCardEditor} type="button">
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
    <div className="rounded-lg border border-line bg-paper/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">资产库</h3>
          <button
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              hasSubCards
                ? "text-moss hover:bg-moss/10"
                : "cursor-not-allowed text-ink/30"
            }`}
            disabled={!hasSubCards}
            onClick={() => setShowReview(true)}
            title={hasSubCards ? "随机复习一张子卡" : "暂无子卡可复习"}
            type="button"
          >
            子卡复习
          </button>
        </div>
        <button
          className="rounded px-2 py-1 text-xs font-medium text-ink/50 transition hover:bg-paper hover:text-ink"
          onClick={() => setCollapsed((c) => !c)}
          type="button"
        >
          {collapsed ? "展开" : "收起"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="mb-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/20"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题或核心洞察..."
              type="text"
              value={searchQuery}
            />
            <select
              className="shrink-0 rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none transition focus:border-moss"
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
            <p className="text-sm text-ink/50">
              {assets.length === 0 ? "暂无资产" : "无匹配资产"}
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((asset) => (
                <li
                  className="group flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2 transition hover:border-moss/40 hover:shadow-sm"
                  key={asset.asset_id}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(asset.asset_id)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
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
                    <div className="mt-1 text-xs text-ink/50">
                      {truncate(asset.core_insight, 60)}
                      <span className="ml-2">{formatTime(asset.created_at)}</span>
                    </div>
                  </button>
                  <button
                    className="shrink-0 rounded p-1 text-ink/30 transition hover:bg-red-50 hover:text-rust"
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
