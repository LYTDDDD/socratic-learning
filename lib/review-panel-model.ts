import type { CognitiveAsset } from "./extract-asset";
import type { ReviewRecord } from "./review-record-store";

export type ReviewPanelStats = {
  totalReviews: number;
  goodCount: number;
  passRate: number;
  neverReviewed: CognitiveAsset[];
  reviewedAssetIds: Set<string>;
  lastReviewAt: string | null;
};

export type ReviewPanelModel = {
  visibleAssets: CognitiveAsset[];
  visibleRecords: ReviewRecord[];
  confirmedAssets: CognitiveAsset[];
  stats: ReviewPanelStats;
};

export function buildReviewPanelModel(
  assets: CognitiveAsset[],
  records: ReviewRecord[],
  currentMissionId?: string | null,
): ReviewPanelModel {
  const visibleAssets = currentMissionId
    ? assets.filter((asset) => asset.source_mission === currentMissionId)
    : assets;

  const visibleRecords = currentMissionId
    ? filterRecordsByAssets(records, visibleAssets)
    : records;

  const confirmedAssets = visibleAssets.filter((asset) => asset.status === "confirmed");
  const totalReviews = visibleRecords.length;
  const goodCount = visibleRecords.filter((record) => record.result === "good").length;
  const passRate = totalReviews > 0 ? Math.round((goodCount / totalReviews) * 100) : 0;
  const reviewedAssetIds = new Set(visibleRecords.map((record) => record.assetId));
  const neverReviewed = confirmedAssets.filter((asset) => !reviewedAssetIds.has(asset.asset_id));
  const lastReviewAt = totalReviews > 0 ? visibleRecords[0].reviewedAt : null;

  return {
    visibleAssets,
    visibleRecords,
    confirmedAssets,
    stats: {
      totalReviews,
      goodCount,
      passRate,
      neverReviewed,
      reviewedAssetIds,
      lastReviewAt,
    },
  };
}

function filterRecordsByAssets(records: ReviewRecord[], assets: CognitiveAsset[]): ReviewRecord[] {
  const assetIds = new Set(assets.map((asset) => asset.asset_id));
  return records.filter((record) => assetIds.has(record.assetId));
}
