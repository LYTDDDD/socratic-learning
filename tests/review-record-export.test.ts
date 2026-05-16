import { describe, expect, it } from "vitest";
import { buildReviewRecordsExport, reviewRecordsExportFilename, serializeReviewRecordsExport } from "../lib/review-record-export";
import type { ReviewRecord } from "../lib/review-record-store";

function makeRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "review_1",
    assetId: "asset_1",
    assetTitle: "Asset One",
    reviewedAt: "2026-05-16T00:00:00.000Z",
    assetMaturityBefore: "Reference",
    assetMaturityAfter: "Reference",
    reviewTypes: ["asset_card"],
    questions: ["Q"],
    answers: ["A"],
    feedback: [{ question: "Q", answer: "A", evaluation: "good", comment: "ok" }],
    overallAssessment: "ok",
    maturitySuggestion: null,
    result: "good",
    maturityUpgradeSuggested: false,
    assetUpdateSuggested: false,
    createdAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("review-record-export", () => {
  it("builds all-records export payload", () => {
    const payload = buildReviewRecordsExport([makeRecord()], null, "2026-05-16T12:00:00.000Z");

    expect(payload).toMatchObject({
      version: 1,
      exportedAt: "2026-05-16T12:00:00.000Z",
      scope: { type: "all", missionId: null },
      count: 1,
    });
    expect(payload.records[0].id).toBe("review_1");
  });

  it("builds mission-scoped export payload", () => {
    const payload = buildReviewRecordsExport([makeRecord()], "mission_a", "2026-05-16T12:00:00.000Z");

    expect(payload.scope).toEqual({ type: "mission", missionId: "mission_a" });
    expect(payload.count).toBe(1);
  });

  it("serializes payload as pretty JSON with trailing newline", () => {
    const text = serializeReviewRecordsExport([makeRecord()], "mission_a", "2026-05-16T12:00:00.000Z");

    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text).scope).toEqual({ type: "mission", missionId: "mission_a" });
  });

  it("builds stable export filenames", () => {
    const exportedAt = new Date("2026-05-16T12:00:00.000Z");

    expect(reviewRecordsExportFilename(null, exportedAt)).toBe("review-records-all-2026-05-16.json");
    expect(reviewRecordsExportFilename("mission/a b", exportedAt)).toBe("review-records-mission-mission-a-b-2026-05-16.json");
  });
});
