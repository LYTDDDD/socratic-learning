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
      <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-paper text-sm text-ink/60">
        暂无 JSON 数据。提交输入后，解析出的 JSON 会显示在这里。
      </div>
    );
  }

  if (parseStatus === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex min-h-32 items-center justify-center rounded-md border border-rust/30 bg-rust/5 text-sm text-rust">
          JSON 解析失败
        </div>
        {raw !== null && (
          <div className="flex flex-col gap-2">
            <button
              className="self-start rounded-md border border-line px-3 py-1.5 text-sm text-ink/70 transition hover:bg-paper"
              onClick={() => setShowRaw((prev) => !prev)}
              type="button"
            >
              {showRaw ? "隐藏 Raw Output" : "查看 Raw Output"}
            </button>
            {showRaw && (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink p-4 text-sm leading-6 text-white">
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
        <div className="flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          部分步骤执行失败，结果可能不完整
        </div>
        {json !== null && (
          <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink p-4 text-sm leading-6 text-white">
            {JSON.stringify(json, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const formatted = JSON.stringify(json, null, 2);

  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink p-4 text-sm leading-6 text-white">
      {formatted}
    </pre>
  );
}
