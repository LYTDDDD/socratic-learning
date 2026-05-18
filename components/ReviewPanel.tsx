"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { CognitiveAsset } from "../lib/extract-asset";
import { loadAssets } from "../lib/asset-store";
import { reviewRecordsExportFilename, serializeReviewRecordsExport } from "../lib/review-record-export";
import { loadReviewRecords } from "../lib/review-record-store";
import type { ReviewRecord } from "../lib/review-record-store";
import { buildReviewPanelModel } from "../lib/review-panel-model";
import { useAssetReview } from "../lib/use-asset-review";
import { formatTime, typeBadgeColor, maturityBadge, resultBadgeColor, resultLabel } from "../lib/ui-utils";
import { AssetReviewFlowView } from "./AssetReviewFlowView";

type ReviewPanelProps = {
  refreshKey: number;
};

export function ReviewPanel({ refreshKey }: ReviewPanelProps) {
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

  const { visibleRecords, confirmedAssets, stats } = useMemo(
    () => buildReviewPanelModel(assets, allRecords, null),
    [assets, allRecords],
  );

  const handleExportRecords = useCallback(() => {
    if (visibleRecords.length === 0) return;
    const exportedAt = new Date();
    const content = serializeReviewRecordsExport(visibleRecords, null, exportedAt.toISOString());
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reviewRecordsExportFilename(null, exportedAt);
    link.click();
    URL.revokeObjectURL(url);
  }, [visibleRecords]);

  if (reviewFlow) {
    return (
      <AssetReviewFlowView
        exitLabel="退出"
        onAnswerChange={updateAnswer}
        onExit={exitReview}
        onRetry={() => startReview(reviewFlow.asset)}
        onSubmit={submitAnswers}
        resultActions={(
          <div className="flex gap-2 border-t border-line pt-3">
            <button
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-2"
              onClick={exitReview}
              type="button"
            >
              返回复习面板
            </button>
          </div>
        )}
        reviewFlow={reviewFlow}
        title="复习评估"
      />
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332-.477-4.5-1.253" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue">Review Mode</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-ink">复习中心</h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">用 AI 评估确认资产是否真正可调用，复习记录会形成审查证据链。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="rounded px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={visibleRecords.length === 0}
            onClick={handleExportRecords}
            type="button"
          >
            导出记录
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
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-center">
              <p className="text-2xl font-bold text-ink">{stats.totalReviews}</p>
              <p className="text-[10px] font-medium text-ink-muted">总复习次数</p>
            </div>
            <div className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-center">
              <p className="text-2xl font-bold text-blue">{stats.passRate}%</p>
              <p className="text-[10px] font-medium text-ink-muted">理解到位率</p>
            </div>
            <div className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-center">
              <p className="text-2xl font-bold text-amber">{stats.neverReviewed.length}</p>
              <p className="text-[10px] font-medium text-ink-muted">待复习资产</p>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-line bg-surface-2/50 p-3">
            <h4 className="text-xs font-semibold text-ink-muted">Review Evidence</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-muted">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-ink-muted/70">已覆盖资产</span>
                <span className="mt-0.5 block text-sm font-semibold text-ink">{stats.reviewedAssetIds.size} / {confirmedAssets.length}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-ink-muted/70">最近复习</span>
                <span className="mt-0.5 block text-sm font-semibold text-ink">{stats.lastReviewAt ? formatTime(stats.lastReviewAt) : "—"}</span>
              </div>
            </div>
          </div>

          {stats.lastReviewAt && (
            <p className="mb-3 text-[10px] text-ink-muted/70">
              上次复习：{formatTime(stats.lastReviewAt)}
            </p>
          )}

          {stats.neverReviewed.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-ink-muted">待复习资产</h4>
              <ul className="space-y-1.5">
                {stats.neverReviewed.map((asset) => (
                  <li key={asset.asset_id} className="flex items-center gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 transition hover:border-blue/40">
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
                      className="shrink-0 rounded border border-blue/40 bg-blue/5 px-2.5 py-1 text-xs font-medium text-blue transition hover:bg-blue/10"
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
              <h4 className="mb-2 text-xs font-semibold text-ink-muted">已复习资产</h4>
              <ul className="space-y-1.5">
                {confirmedAssets
                  .filter((a) => stats.reviewedAssetIds.has(a.asset_id))
                  .map((asset) => {
                    const assetRecords = visibleRecords.filter((r) => r.assetId === asset.asset_id);
                    const lastRecord = assetRecords[0];
                    return (
                      <li key={asset.asset_id} className="flex items-center gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 transition hover:border-blue/40">
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
                        <span className="shrink-0 text-[10px] text-ink-muted/70">{assetRecords.length} 次</span>
                        <button
                          className="shrink-0 rounded border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
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
              <h4 className="mb-2 text-xs font-semibold text-ink-muted">复习记录时间线</h4>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto">
                {visibleRecords.slice(0, 20).map((record) => (
                  <li key={record.id} className="flex items-center gap-2 rounded-md border border-line bg-surface-1 px-3 py-1.5">
                    <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${resultBadgeColor(record.result)}`}>
                      {resultLabel(record.result)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                      {record.assetTitle || record.assetId}
                    </span>
                    <span className="shrink-0 text-[10px] text-ink-muted/70">{formatTime(record.reviewedAt)}</span>
                  </li>
                ))}
              </ul>
              {visibleRecords.length > 20 && (
                <p className="mt-1 text-[10px] text-ink-muted/70">仅显示最近 20 条</p>
              )}
            </div>
          )}

          {confirmedAssets.length === 0 && (
            <p className="text-sm text-ink-muted">暂无已确认资产可供复习</p>
          )}
        </>
      )}
    </div>
  );
}
