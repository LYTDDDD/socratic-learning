import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadButton } from "../components/DownloadButton";
import type { AnalyzeResponse } from "../lib/analyze-types";

function makeResult(overrides: Partial<AnalyzeResponse> = {}): AnalyzeResponse {
  return {
    markdown: "# Report",
    json: { ok: true },
    raw: "raw model text",
    parseStatus: "success",
    error: null,
    runLog: null,
    ...overrides,
  };
}

describe("DownloadButton", () => {
  it("labels raw download as model original output", () => {
    render(<DownloadButton result={makeResult()} />);

    fireEvent.click(screen.getByRole("button", { name: "下载" }));

    expect(screen.getByRole("button", { name: ".txt模型原始输出" })).toBeInTheDocument();
  });
});
