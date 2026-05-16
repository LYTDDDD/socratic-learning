"use client";

import type { ReactNode } from "react";
import { feedbackSurfaceColor, resultBadgeColor, resultLabel } from "../lib/ui-utils";
import type { ReviewFlowState } from "../lib/use-asset-review";

type ActiveReviewFlow = NonNullable<ReviewFlowState>;

type AssetReviewFlowViewProps = {
  reviewFlow: ActiveReviewFlow;
  title: string;
  exitLabel: string;
  onExit: () => void;
  onRetry: () => void;
  onAnswerChange: (index: number, value: string) => void;
  onSubmit: () => void;
  className?: string;
  resultActions?: ReactNode;
};

export function AssetReviewFlowView({
  reviewFlow,
  title,
  exitLabel,
  onExit,
  onRetry,
  onAnswerChange,
  onSubmit,
  className = "rounded-lg border border-line bg-paper/60 p-4",
  resultActions,
}: AssetReviewFlowViewProps) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <span className="text-xs text-ink/50">{reviewFlow.asset.title || reviewFlow.asset.asset_id}</span>
        </div>
        <button
          className="rounded px-2 py-1 text-xs font-medium text-ink/40 transition hover:bg-paper hover:text-ink"
          onClick={onExit}
          type="button"
        >
          {exitLabel}
        </button>
      </div>

      {reviewFlow.phase === "loading_questions" && (
        <LoadingMessage>AI 正在生成评估问题...</LoadingMessage>
      )}

      {reviewFlow.phase === "answering" && (
        <div className="space-y-3">
          {reviewFlow.questions.map((question, index) => (
            <div key={index} className="rounded-lg border border-line bg-paper/60 p-3">
              <p className="mb-2 text-sm font-medium text-ink">{index + 1}. {question}</p>
              <textarea
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-1 focus:ring-moss/20"
                onChange={(event) => onAnswerChange(index, event.target.value)}
                placeholder="写下你的回答..."
                rows={3}
                value={reviewFlow.answers[index]}
              />
            </div>
          ))}
          <button
            className="rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
            disabled={reviewFlow.answers.some((answer) => !answer.trim())}
            onClick={onSubmit}
            type="button"
          >
            提交评估
          </button>
        </div>
      )}

      {reviewFlow.phase === "loading_feedback" && (
        <LoadingMessage>AI 正在分析你的回答...</LoadingMessage>
      )}

      {reviewFlow.phase === "result" && (
        <div className="space-y-3">
          {reviewFlow.feedback.map((feedback, index) => (
            <div key={index} className={`rounded-lg border p-3 ${feedbackSurfaceColor(feedback.evaluation)}`}>
              <div className="mb-1 flex items-center gap-2">
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${resultBadgeColor(feedback.evaluation)}`}>
                  {resultLabel(feedback.evaluation)}
                </span>
                <span className="text-[10px] text-ink/40">问题 {index + 1}</span>
              </div>
              <p className="mb-1 text-xs font-medium text-ink/70">{feedback.question}</p>
              <p className="mb-1 text-xs text-ink/50 italic">你的回答：{feedback.answer || "（未回答）"}</p>
              <p className="text-xs text-ink">{feedback.comment}</p>
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
          {resultActions}
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
              onClick={onRetry}
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

function LoadingMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-moss/30 bg-moss/5 px-4 py-6 text-sm text-ink/60">
      <svg className="h-4 w-4 animate-spin text-moss" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
      </svg>
      {children}
    </div>
  );
}
