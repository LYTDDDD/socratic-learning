"use client";

import { useState } from "react";
import type { ReviewRecord } from "../lib/review-record-store";
import { feedbackMarkerBadge, feedbackMarkerLabel, formatTime, resultBadgeColor, resultLabel } from "../lib/ui-utils";

type AssetReviewHistoryProps = {
  records: ReviewRecord[];
};

export function AssetReviewHistory({ records }: AssetReviewHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (records.length === 0) return null;

  return (
    <div className="border-t border-line pt-4">
      <div className="mb-2 flex items-center gap-2">
        <dt className="text-xs font-semibold text-ink-muted">复习记录</dt>
        <button
          className="flex items-center gap-1 text-xs font-medium text-ink-muted transition hover:text-ink"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {records.length} 次
        </button>
      </div>
      {expanded && (
        <dd className="space-y-2">
          {records.map((record) => (
            <div key={record.id} className="rounded border border-line bg-surface-1 px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${resultBadgeColor(record.result)}`}>
                    {resultLabel(record.result)}
                  </span>
                  {record.maturityUpgradeSuggested && (
                    <span className="inline-block rounded bg-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-blue">
                      建议升级
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-ink-muted/70">{formatTime(record.reviewedAt)}</span>
              </div>
              <p className="text-xs text-ink-muted line-clamp-2">{record.overallAssessment || "—"}</p>
              {record.feedback.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {record.feedback.map((feedback, index) => (
                    <div key={index} className="flex items-start gap-1.5">
                      <span className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${feedbackMarkerBadge(feedback.evaluation)}`}>
                        {feedbackMarkerLabel(feedback.evaluation)}
                      </span>
                      <p className="text-[11px] leading-4 text-ink-muted line-clamp-1">{feedback.question}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </dd>
      )}
    </div>
  );
}
