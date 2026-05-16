import type { ReviewRecord } from "./review-record-store";

export type ReviewRecordsExportPayload = {
  version: 1;
  exportedAt: string;
  scope: {
    type: "all" | "mission";
    missionId: string | null;
  };
  count: number;
  records: ReviewRecord[];
};

export function buildReviewRecordsExport(
  records: ReviewRecord[],
  missionId: string | null = null,
  exportedAt = new Date().toISOString(),
): ReviewRecordsExportPayload {
  return {
    version: 1,
    exportedAt,
    scope: {
      type: missionId ? "mission" : "all",
      missionId,
    },
    count: records.length,
    records,
  };
}

export function serializeReviewRecordsExport(
  records: ReviewRecord[],
  missionId: string | null = null,
  exportedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify(buildReviewRecordsExport(records, missionId, exportedAt), null, 2)}\n`;
}

export function reviewRecordsExportFilename(missionId: string | null = null, exportedAt = new Date()): string {
  const date = exportedAt.toISOString().slice(0, 10);
  const scope = missionId ? `mission-${sanitizeFilenamePart(missionId)}` : "all";
  return `review-records-${scope}-${date}.json`;
}

function sanitizeFilenamePart(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "unknown";
}
