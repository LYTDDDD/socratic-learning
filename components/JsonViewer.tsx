"use client";

import { useState } from "react";
import type { AnalyzeResponse } from "../lib/analyze-types";

type JsonViewerProps = {
  json: unknown | null;
  parseStatus: AnalyzeResponse["parseStatus"];
  raw: string | null;
};

export function JsonViewer({ json, parseStatus, raw }: JsonViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (parseStatus === "not_attempted" || ((parseStatus === "success" || parseStatus === "partial") && json === null)) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-surface-1 text-sm text-ink-muted">
        暂无 JSON 数据。提交输入后，解析出的 JSON 会显示在这里。
      </div>
    );
  }

  if (parseStatus === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex min-h-32 items-center justify-center rounded-md border border-amber/30 bg-amber/5 text-sm text-amber">
          JSON 解析失败
        </div>
        {raw !== null && (
          <div className="flex flex-col gap-2">
            <button
              className="self-start rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:bg-surface-2"
              onClick={() => setShowRaw((prev) => !prev)}
              type="button"
            >
              {showRaw ? "隐藏模型原始输出" : "查看模型原始输出"}
            </button>
            {showRaw && (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-sm leading-6 text-white">
                {raw}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }

  if (parseStatus === "partial") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-amber/20 bg-amber/10 px-3 py-2 text-sm text-amber">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          部分步骤执行失败，结果可能不完整
        </div>
        {json !== null && (
          <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-sm leading-6 text-white">
            {JSON.stringify(json, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const formatted = JSON.stringify(json, null, 2);

  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-sm leading-6 text-white">
      {formatted}
    </pre>
  );
}
