"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { CognitiveAsset } from "../lib/extract-asset";
import { loadAssets } from "../lib/asset-store";
import { loadReviewRecords } from "../lib/review-record-store";
import type { ReviewRecord } from "../lib/review-record-store";
import { useAssetReview } from "../lib/use-asset-review";
import { formatTime, typeBadgeColor, maturityBadge, resultBadgeColor, resultLabel } from "../lib/ui-utils";

type ReviewPanelProps = {
  refreshKey: number;
  currentMissionId?: string | null;
};

export function ReviewPanel({ refreshKey, currentMissionId }: ReviewPanelProps) {
  const [assets, setAssets] = useState<CognitiveAsset[]>([]);
  const [allRecords, setAllRecords] = useState<ReviewRecord[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const refreshRecords = useCallback(() => {
    setAllRecords(loadReviewRecords());
  }, []);

  const { reviewFlow, startReview, updateAnswer, submitAnswers, exitReview } = useAssetReview(refreshRecords);

  useEffect(() => {
    setAssets(loadAssets());
    setAllRecords(loadReviewRecords());
  }, [refreshKey]);

  const visibleAssets = useMemo(
    () => currentMissionId
      ? assets.filter((a) => a.source_mission === currentMissionId)
      : assets,
    [assets, currentMissionId],
  );

  const visibleRecords = useMemo(() => {
    if (!currentMissionId) return allRecords;
    const visibleAssetIds = new Set(visibleAssets.map((a) => a.asset_id));
    return allRecords.filter((record) => visibleAssetIds.has(record.assetId));
  }, [allRecords, currentMissionId, visibleAssets]);

  const confirmedAssets = useMemo(
    () => visibleAssets.filter((a) => a.status === "confirmed"),
    [visibleAssets],
  );

  const stats = useMemo(() => {
    const totalReviews = visibleRecords.length;
    const goodCount = visibleRecords.filter((r) => r.result === "good").length;
    const passRate = totalReviews > 0 ? Math.round((goodCount / totalReviews) * 100) : 0;
    const reviewedAssetIds = new Set(visibleRecords.map((r) => r.assetId));
    const neverReviewed = confirmedAssets.filter((a) => !reviewedAssetIds.has(a.asset_id));
    const lastReviewAt = totalReviews > 0 ? visibleRecords[0].reviewedAt : null;
    return { totalReviews, goodCount, passRate, neverReviewed, reviewedAssetIds, lastReviewAt };
  }, [visibleRecords, confirmedAssets]);

  if (reviewFlow) {
    return (
      <div className="rounded-lg border border-line bg-paper/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="text-sm font-semibold text-ink">复习评估</h3>
            <span className="text-xs text-ink/50">{reviewFlow.asset.title || reviewFlow.asset.asset_id}</span>
          </div>
          <button
            className="rounded px-2 py-1 text-xs font-medium text-ink/40 transition hover:bg-paper hover:text-ink"
            onClick={exitReview}
            type="button"
          >
            退出
          </button>
        </div>

        {reviewFlow.phase === "loading_questions" && (
          <div className="flex items-center gap-2 rounded-lg border border-moss/30 bg-moss/5 px-4 py-6 text-sm text-ink/60">
            <svg className="h-4 w-4 animate-spin text-moss" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
            </svg>
            AI 正在生成评估问题...
          </div>
        )}

        {reviewFlow.phase === "answering" && (
          <div className="space-y-3">
            {reviewFlow.questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-line bg-paper/60 p-3">
                <p className="mb-2 text-sm font-medium text-ink">{i + 1}. {q}</p>
                <textarea
                  className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  placeholder="写下你的回答..."
                  rows={3}
                  value={reviewFlow.answers[i]}
                />
              </div>
            ))}
            <button
              className="rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
              disabled={reviewFlow.answers.some((a) => !a.trim())}
              onClick={submitAnswers}
              type="button"
            >
              提交评估
            </button>
          </div>
        )}

        {reviewFlow.phase === "loading_feedback" && (
          <div className="flex items-center gap-2 rounded-lg border border-moss/30 bg-moss/5 px-4 py-6 text-sm text-ink/60">
            <svg className="h-4 w-4 animate-spin text-moss" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
            </svg>
            AI 正在分析你的回答...
          </div>
        )}

        {reviewFlow.phase === "result" && (
          <div className="space-y-3">
            {reviewFlow.feedback.map((f, i) => (
              <div key={i} className={`rounded-lg border p-3 ${
                f.evaluation === "good" ? "border-moss/30 bg-moss/5" :
                f.evaluation === "partial" ? "border-yellow-300/30 bg-yellow-50" :
                "border-rust/20 bg-rust/5"
              }`}>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    f.evaluation === "good" ? "bg-moss/15 text-moss" :
                    f.evaluation === "partial" ? "bg-yellow-100 text-yellow-700" :
                    "bg-rust/10 text-rust"
                  }`}>
                    {f.evaluation === "good" ? "理解到位" : f.evaluation === "partial" ? "部分理解" : "需要补充"}
                  </span>
                  <span className="text-[10px] text-ink/40">问题 {i + 1}</span>
                </div>
                <p className="mb-1 text-xs font-medium text-ink/70">{f.question}</p>
                <p className="mb-1 text-xs text-ink/50 italic">你的回答：{f.answer || "（未回答）"}</p>
                <p className="text-xs text-ink">{f.comment}</p>
              </div>
            ))}
            <div className="rounded-lg border border-line bg-paper/60 p-3">
              <dt className="mb-1 text-xs font-semibold text-ink/70">整体评估</dt>
              <dd className="text-sm text-ink">{reviewFlow.overallAssessment || "—"}</dd>
            </div>
            <p className="text-[10px] text-ink/40">
              {reviewFlow.recordSaved ? "复习记录已保存。" : "复习记录保存失败，请稍后重试。"}
            </p>
            {reviewFlow.maturitySuggestion && (
              <div className="rounded-lg border border-moss/30 bg-moss/5 p-3">
                <dt className="mb-1 flex items-center gap-1 text-xs font-semibold text-moss">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  成熟度建议
                </dt>
                <dd className="text-sm text-ink">
                  从 <span className="font-medium text-rust">{reviewFlow.maturitySuggestion.current}</span> 升级到{" "}
                  <span className="font-medium text-moss">{reviewFlow.maturitySuggestion.suggested}</span> — {reviewFlow.maturitySuggestion.reason}
                </dd>
                <p className="mt-1 text-[10px] text-ink/40">这是建议，不会自动修改资产。</p>
              </div>
            )}
            <div className="flex gap-2 border-t border-line pt-3">
              <button
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-paper"
                onClick={exitReview}
                type="button"
              >
                返回复习面板
              </button>
            </div>
          </div>
        )}

        {reviewFlow.phase === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-rust/20 bg-rust/5 p-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-rust" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-sm text-rust">Review 出错</p>
              <p className="mt-0.5 text-xs text-ink/50">{reviewFlow.message}</p>
              <button
                className="mt-2 rounded border border-rust/30 px-3 py-1 text-xs font-medium text-rust transition hover:bg-rust/10"
                onClick={() => startReview(reviewFlow.asset)}
                type="button"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="text-sm font-semibold text-ink">复习中心</h3>
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
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-line bg-white px-3 py-2 text-center">
              <p className="text-2xl font-bold text-ink">{stats.totalReviews}</p>
              <p className="text-[10px] font-medium text-ink/50">总复习次数</p>
            </div>
            <div className="rounded-lg border border-line bg-white px-3 py-2 text-center">
              <p className="text-2xl font-bold text-moss">{stats.passRate}%</p>
              <p className="text-[10px] font-medium text-ink/50">理解到位率</p>
            </div>
            <div className="rounded-lg border border-line bg-white px-3 py-2 text-center">
              <p className="text-2xl font-bold text-rust">{stats.neverReviewed.length}</p>
              <p className="text-[10px] font-medium text-ink/50">待复习资产</p>
            </div>
          </div>

          {stats.lastReviewAt && (
            <p className="mb-3 text-[10px] text-ink/40">
              上次复习：{formatTime(stats.lastReviewAt)}
            </p>
          )}

          {stats.neverReviewed.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-ink/70">待复习资产</h4>
              <ul className="space-y-1.5">
                {stats.neverReviewed.map((asset) => (
                  <li key={asset.asset_id} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 transition hover:border-moss/40">
                    <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeColor(asset.asset_type)}`}>
                      {asset.asset_type}
                    </span>
                    <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${maturityBadge(asset.maturity)}`}>
                      {asset.maturity}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {asset.title || "未命名"}
                    </span>
                    <button
                      className="shrink-0 rounded border border-moss/40 bg-moss/5 px-2.5 py-1 text-xs font-medium text-moss transition hover:bg-moss/10"
                      onClick={() => startReview(asset)}
                      type="button"
                    >
                      开始复习
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {confirmedAssets.length > 0 && stats.neverReviewed.length < confirmedAssets.length && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-ink/70">已复习资产</h4>
              <ul className="space-y-1.5">
                {confirmedAssets
                  .filter((a) => stats.reviewedAssetIds.has(a.asset_id))
                  .map((asset) => {
                    const assetRecords = visibleRecords.filter((r) => r.assetId === asset.asset_id);
                    const lastRecord = assetRecords[0];
                    return (
                      <li key={asset.asset_id} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 transition hover:border-moss/40">
                        <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeColor(asset.asset_type)}`}>
                          {asset.asset_type}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {asset.title || "未命名"}
                        </span>
                        {lastRecord && (
                          <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${resultBadgeColor(lastRecord.result)}`}>
                            {resultLabel(lastRecord.result)}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px] text-ink/40">{assetRecords.length} 次</span>
                        <button
                          className="shrink-0 rounded border border-line px-2.5 py-1 text-xs font-medium text-ink/60 transition hover:bg-paper hover:text-ink"
                          onClick={() => startReview(asset)}
                          type="button"
                        >
                          再复习
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          {visibleRecords.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-ink/70">复习记录时间线</h4>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto">
                {visibleRecords.slice(0, 20).map((record) => (
                  <li key={record.id} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5">
                    <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${resultBadgeColor(record.result)}`}>
                      {resultLabel(record.result)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink/70">
                      {record.assetTitle || record.assetId}
                    </span>
                    <span className="shrink-0 text-[10px] text-ink/40">{formatTime(record.reviewedAt)}</span>
                  </li>
                ))}
              </ul>
              {visibleRecords.length > 20 && (
                <p className="mt-1 text-[10px] text-ink/40">仅显示最近 20 条</p>
              )}
            </div>
          )}

          {confirmedAssets.length === 0 && (
            <p className="text-sm text-ink/50">暂无已确认资产可供复习</p>
          )}
        </>
      )}
    </div>
  );
}
