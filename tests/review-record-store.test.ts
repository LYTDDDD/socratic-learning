import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadReviewRecords, saveReviewRecord } from "../lib/review-record-store";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  clear(): void {
    this.store = {};
  }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

beforeEach(() => {
  localStorage.clear();
});

function makeRecord(assetId = "asset_1") {
  return {
    assetId,
    assetTitle: "Test asset",
    assetMaturityBefore: "Reference",
    assetMaturityAfter: "Understanding",
    reviewTypes: ["asset_card"],
    questions: ["How would you use it?"],
    answers: ["In a real decision."],
    feedback: [
      {
        question: "How would you use it?",
        answer: "In a real decision.",
        evaluation: "good" as const,
        comment: "Clear enough.",
      },
    ],
    overallAssessment: "Good understanding.",
    maturitySuggestion: {
      current: "Reference",
      suggested: "Understanding",
      reason: "The answer included a concrete use case.",
    },
    result: "good" as const,
    maturityUpgradeSuggested: true,
    assetUpdateSuggested: true,
  };
}

describe("review-record-store", () => {
  it("saves and loads review records", () => {
    const saved = saveReviewRecord(makeRecord());

    expect(saved).not.toBeNull();
    expect(saved!.id).toMatch(/^review_/);
    expect(saved!.createdAt).toBeTruthy();
    expect(saved!.reviewedAt).toBeTruthy();
    expect(loadReviewRecords()).toHaveLength(1);
  });

  it("filters records by asset id", () => {
    saveReviewRecord(makeRecord("asset_1"));
    saveReviewRecord(makeRecord("asset_2"));

    const records = loadReviewRecords("asset_1");
    expect(records).toHaveLength(1);
    expect(records[0].assetId).toBe("asset_1");
  });

  it("returns empty array for malformed storage", () => {
    localStorage.setItem("socratic-review-records", JSON.stringify({ assetId: "asset_1" }));

    expect(loadReviewRecords()).toEqual([]);
  });

  it("drops malformed record entries", () => {
    localStorage.setItem(
      "socratic-review-records",
      JSON.stringify([
        { id: "bad" },
        {
          ...makeRecord(),
          id: "review_valid",
          reviewedAt: "2026-05-14T00:00:00.000Z",
          createdAt: "2026-05-14T00:00:00.000Z",
        },
      ]),
    );

    expect(loadReviewRecords()).toHaveLength(1);
    expect(loadReviewRecords()[0].id).toBe("review_valid");
  });
});
