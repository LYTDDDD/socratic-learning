"use client";

import { useState, useRef, useEffect } from "react";
import type { AnalyzeResponse } from "../lib/analyze-types";

type DownloadButtonProps = {
  result: AnalyzeResponse | null;
};

type DownloadOption = {
  label: string;
  ext: string;
  content: string | null;
  available: boolean;
};

function getTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownloadButton({ result }: DownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const stamp = getTimestamp();

  const options: DownloadOption[] = [
    {
      label: "Markdown",
      ext: "md",
      content: result?.markdown ?? null,
      available: result?.markdown != null,
    },
    {
      label: "JSON",
      ext: "json",
      content:
        result?.json != null && (result.parseStatus === "success" || result.parseStatus === "partial")
          ? JSON.stringify(result.json, null, 2)
          : null,
      available: result?.json != null && (result.parseStatus === "success" || result.parseStatus === "partial"),
    },
    {
      label: "Raw Text",
      ext: "txt",
      content: result?.raw ?? null,
      available: result?.raw != null,
    },
  ];

  const hasAnyAvailable = options.some((o) => o.available);

  function handleSelect(opt: DownloadOption) {
    if (!opt.available || opt.content == null) return;
    const mimeTypes: Record<string, string> = {
      md: "text/markdown;charset=utf-8",
      json: "application/json;charset=utf-8",
      txt: "text/plain;charset=utf-8",
    };
    download(opt.content, `analysis-${stamp}.${opt.ext}`, mimeTypes[opt.ext]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!hasAnyAvailable}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" x2="12" y1="15" y2="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        下载
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-line bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              className={`flex w-full items-center px-3 py-2 text-xs font-medium transition ${
                opt.available
                  ? "text-ink hover:bg-paper"
                  : "cursor-not-allowed text-ink/30"
              }`}
              disabled={!opt.available}
              key={opt.ext}
              onClick={() => handleSelect(opt)}
              type="button"
            >
              <span className="mr-2 inline-block w-10 text-left font-semibold uppercase text-moss">
                .{opt.ext}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
