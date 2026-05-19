"use client";

import { useState } from "react";

type CopyButtonProps = {
  content: string | null;
  label?: string;
  onCopied?: () => void;
};

export function CopyButton({ content, label = "复制", onCopied }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (content == null) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={content == null}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <>
          <svg
            className="h-3.5 w-3.5 text-green"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          已复制
        </>
      ) : (
        <>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
