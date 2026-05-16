export type ReviewEvaluation = "good" | "partial" | "needs_work";

export type ReviewFeedbackItem = {
  question: string;
  answer: string;
  evaluation: ReviewEvaluation;
  comment: string;
};

export type ReviewMaturitySuggestion = {
  current: string;
  suggested: string;
  reason: string;
};

export type ReviewRecord = {
  id: string;
  assetId: string;
  assetTitle: string;
  reviewedAt: string;
  assetMaturityBefore: string;
  assetMaturityAfter: string;
  reviewTypes: string[];
  questions: string[];
  answers: string[];
  feedback: ReviewFeedbackItem[];
  overallAssessment: string;
  maturitySuggestion: ReviewMaturitySuggestion | null;
  result: ReviewEvaluation;
  maturityUpgradeSuggested: boolean;
  assetUpdateSuggested: boolean;
  createdAt: string;
};

const STORAGE_KEY = "socratic-review-records";
const REVIEW_EVALUATIONS: ReviewEvaluation[] = ["good", "partial", "needs_work"];

function generateReviewRecordId(): string {
  return `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isReviewEvaluation(value: unknown): value is ReviewEvaluation {
  return typeof value === "string" && REVIEW_EVALUATIONS.includes(value as ReviewEvaluation);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReviewFeedbackItem(value: unknown): value is ReviewFeedbackItem {
  if (!value || typeof value !== "object") return false;
  const feedback = value as Partial<ReviewFeedbackItem>;
  return (
    typeof feedback.question === "string" &&
    typeof feedback.answer === "string" &&
    isReviewEvaluation(feedback.evaluation) &&
    typeof feedback.comment === "string"
  );
}

function isReviewRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ReviewRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.assetId === "string" &&
    typeof record.reviewedAt === "string" &&
    isStringArray(record.questions) &&
    isStringArray(record.answers) &&
    Array.isArray(record.feedback) &&
    record.feedback.every(isReviewFeedbackItem) &&
    isReviewEvaluation(record.result)
  );
}

export function loadReviewRecords(assetId?: string): ReviewRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const records = parsed.filter(isReviewRecord);
    const sorted = records.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    if (!assetId) return sorted;
    return sorted.filter((record) => record.assetId === assetId);
  } catch (err) {
    console.warn("loadReviewRecords: failed to parse localStorage data", err);
    return [];
  }
}

export function deleteReviewRecordsByAssetId(assetId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return true;
    const remaining = parsed.filter((item) => {
      if (!item || typeof item !== "object") return true;
      return (item as Partial<ReviewRecord>).assetId !== assetId;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    return true;
  } catch {
    return false;
  }
}

export function saveReviewRecord(record: Omit<ReviewRecord, "id" | "createdAt" | "reviewedAt"> & { reviewedAt?: string }): ReviewRecord | null {
  try {
    const now = new Date().toISOString();
    const entry: ReviewRecord = {
      ...record,
      id: generateReviewRecordId(),
      reviewedAt: record.reviewedAt ?? now,
      createdAt: now,
    };
    const records = loadReviewRecords();
    records.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return entry;
  } catch {
    return null;
  }
}
