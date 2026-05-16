import { useState, useCallback } from "react";
import type { CognitiveAsset } from "./extract-asset";
import { saveReviewRecord, loadReviewRecords } from "./review-record-store";
import type { ReviewFeedbackItem, ReviewMaturitySuggestion } from "./review-record-store";

export type ReviewFlowState =
  | null
  | { phase: "loading_questions"; asset: CognitiveAsset }
  | { phase: "answering"; asset: CognitiveAsset; questions: string[]; answers: string[] }
  | { phase: "loading_feedback"; asset: CognitiveAsset }
  | {
      phase: "result";
      asset: CognitiveAsset;
      feedback: ReviewFeedbackItem[];
      overallAssessment: string;
      maturitySuggestion: ReviewMaturitySuggestion | null;
      recordSaved: boolean;
    }
  | { phase: "error"; asset: CognitiveAsset; message: string };

function summarizeReviewResult(feedback: ReviewFeedbackItem[]): "good" | "partial" | "needs_work" {
  if (feedback.some((item) => item.evaluation === "needs_work")) return "needs_work";
  if (feedback.some((item) => item.evaluation === "partial")) return "partial";
  return "good";
}

export function useAssetReview(onRecordSaved?: () => void) {
  const [reviewFlow, setReviewFlow] = useState<ReviewFlowState>(null);

  const startReview = useCallback(async (asset: CognitiveAsset) => {
    setReviewFlow({ phase: "loading_questions", asset });
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "questions",
          assetId: asset.asset_id,
          assetTitle: asset.title,
          coreInsight: asset.core_insight,
          originalJudgment: asset.original_judgment,
          revisedJudgment: asset.revised_judgment,
          myUnderstanding: asset.my_understanding,
          transferableValue: asset.transferable_value,
          reviewQuestions: asset.review_questions,
          maturity: asset.maturity,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setReviewFlow({ phase: "error", asset, message: data.error });
        return;
      }
      const questions: string[] = data.questions ?? [];
      if (questions.length === 0) {
        setReviewFlow({ phase: "error", asset, message: "AI 未生成评估问题。" });
        return;
      }
      setReviewFlow({ phase: "answering", asset, questions, answers: questions.map(() => "") });
    } catch (err) {
      setReviewFlow({ phase: "error", asset, message: err instanceof Error ? err.message : "网络错误" });
    }
  }, []);

  const updateAnswer = useCallback((index: number, value: string) => {
    setReviewFlow((prev) => {
      if (!prev || prev.phase !== "answering") return prev;
      const answers = [...prev.answers];
      answers[index] = value;
      return { ...prev, answers };
    });
  }, []);

  const submitAnswers = useCallback(async () => {
    if (!reviewFlow || reviewFlow.phase !== "answering") return;
    const { asset, questions, answers } = reviewFlow;
    setReviewFlow({ phase: "loading_feedback", asset });
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "feedback",
          assetId: asset.asset_id,
          assetTitle: asset.title,
          coreInsight: asset.core_insight,
          originalJudgment: asset.original_judgment,
          revisedJudgment: asset.revised_judgment,
          myUnderstanding: asset.my_understanding,
          transferableValue: asset.transferable_value,
          maturity: asset.maturity,
          questions,
          answers,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setReviewFlow({ phase: "error", asset, message: data.error });
        return;
      }
      const feedback: ReviewFeedbackItem[] = data.feedback ?? [];
      const maturitySuggestion: ReviewMaturitySuggestion | null = data.maturitySuggestion ?? null;
      const maturityUpgradeSuggested =
        Boolean(maturitySuggestion) &&
        maturitySuggestion?.suggested !== maturitySuggestion?.current;
      const saved = saveReviewRecord({
        assetId: asset.asset_id,
        assetTitle: asset.title,
        assetMaturityBefore: asset.maturity,
        assetMaturityAfter: maturitySuggestion?.suggested ?? asset.maturity,
        reviewTypes: ["asset_card"],
        questions,
        answers,
        feedback,
        overallAssessment: data.overallAssessment ?? "",
        maturitySuggestion,
        result: summarizeReviewResult(feedback),
        maturityUpgradeSuggested,
        assetUpdateSuggested: maturityUpgradeSuggested,
      });
      setReviewFlow({
        phase: "result",
        asset,
        feedback,
        overallAssessment: data.overallAssessment ?? "",
        maturitySuggestion,
        recordSaved: Boolean(saved),
      });
      if (saved) {
        onRecordSaved?.();
      }
    } catch (err) {
      setReviewFlow({ phase: "error", asset, message: err instanceof Error ? err.message : "网络错误" });
    }
  }, [reviewFlow, onRecordSaved]);

  const exitReview = useCallback(() => {
    setReviewFlow(null);
  }, []);

  return { reviewFlow, startReview, updateAnswer, submitAnswers, exitReview };
}
