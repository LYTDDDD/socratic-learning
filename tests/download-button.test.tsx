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

  it("labels multi-agent raw download as agent execution trace", () => {
    render(
      <DownloadButton
        result={makeResult({
          runLog: {
            run_id: "run_multi_agent_download",
            created_at: "2026-05-20T00:00:00.000Z",
            input_snapshot: { originalGoal: "goal", conversation: "conversation" },
            prompt_version: "multi-agent:offline-mission-analysis-v0.3-json-only",
            model_name: "test-model",
            request_status: "success",
            parse_status: "success",
            duration_ms: 100,
            error_message: null,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下载" }));

    expect(screen.getByRole("button", { name: ".txtAgent 执行轨迹" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ".txt模型原始输出" })).not.toBeInTheDocument();
  });

  it("falls back to parsed agent steps when runLog is missing", () => {
    render(
      <DownloadButton
        result={makeResult({
          raw: JSON.stringify({
            steps: [
              {
                agent: "supervisor",
                startedAt: "2026-01-01T00:00:00Z",
                finishedAt: "2026-01-01T00:00:01Z",
                input: {},
                output: { steps: ["review"] },
                status: "success",
                error: null,
              },
            ],
            supervisorDecision: "done",
          }),
          runLog: null,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下载" }));

    expect(screen.getByRole("button", { name: ".txtAgent 执行轨迹" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ".txt模型原始输出" })).not.toBeInTheDocument();
  });
});
