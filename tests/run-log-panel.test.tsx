import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunLogPanel } from "../components/RunLogPanel";
import type { RunLog } from "../lib/run-log";

function makeRunLog(overrides: Partial<RunLog> = {}): RunLog {
  return {
    run_id: "run_panel_123",
    created_at: "2026-05-20T00:00:00.000Z",
    input_snapshot: { originalGoal: "test goal", conversation: "test conversation" },
    prompt_version: "offline-mission-analysis-v0.3-json-only",
    model_name: "test-model",
    request_status: "success",
    parse_status: "success",
    duration_ms: 123,
    error_message: null,
    ...overrides,
  };
}

describe("RunLogPanel", () => {
  it("renders collapsed for successful run logs and expands details on click", () => {
    render(<RunLogPanel runLog={makeRunLog()} />);

    expect(screen.getByText("Evidence Trail")).toBeInTheDocument();
    expect(screen.getByText("Run Log")).toBeInTheDocument();
    expect(screen.queryByText("Run ID")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Run Log/ }));

    expect(screen.getByText("Run ID")).toBeInTheDocument();
    expect(screen.getByText("run_panel_123")).toBeInTheDocument();
    expect(screen.getByText("Request Status")).toBeInTheDocument();
    expect(screen.getByText("Parse Status")).toBeInTheDocument();
    expect(screen.getByText("errors").parentElement).toHaveTextContent("0");
  });

  it("renders expanded for failed run logs", () => {
    render(
      <RunLogPanel
        runLog={makeRunLog({
          request_status: "failed",
          parse_status: "not_attempted",
          error_message: "model call failed",
        })}
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("model call failed")).toBeInTheDocument();
    expect(screen.getByText("errors").parentElement).toHaveTextContent("1");
  });

  it("shows only the latest five user actions in newest-first order", () => {
    render(
      <RunLogPanel
        runLog={makeRunLog({
          user_actions: [
            { type: "copy_report", at: "2026-05-20T00:00:01.000Z" },
            { type: "copy_json", at: "2026-05-20T00:00:02.000Z" },
            { type: "download_json", at: "2026-05-20T00:00:03.000Z" },
            { type: "mark_reviewed", at: "2026-05-20T00:00:04.000Z" },
            { type: "mark_discarded", at: "2026-05-20T00:00:05.000Z" },
            { type: "restore_report", at: "2026-05-20T00:00:06.000Z" },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Run Log/ }));
    const actionSection = screen.getByText("User Actions").parentElement;
    expect(actionSection).not.toBeNull();
    const scoped = within(actionSection!);

    expect(scoped.queryByText("复制报告")).not.toBeInTheDocument();
    expect(scoped.getByText("恢复报告")).toBeInTheDocument();
    expect(scoped.getByText("标记废弃")).toBeInTheDocument();
    expect(scoped.getByText("标记已审阅")).toBeInTheDocument();
    expect(scoped.getByText("下载 JSON")).toBeInTheDocument();
    expect(scoped.getByText("复制 JSON")).toBeInTheDocument();
  });

  it("labels raw user actions as model original output", () => {
    render(
      <RunLogPanel
        runLog={makeRunLog({
          user_actions: [
            { type: "copy_raw", at: "2026-05-20T00:00:01.000Z" },
            { type: "download_raw", at: "2026-05-20T00:00:02.000Z" },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Run Log/ }));

    expect(screen.getByText("复制模型原始输出")).toBeInTheDocument();
    expect(screen.getByText("下载模型原始输出")).toBeInTheDocument();
  });

  it("labels multi-agent raw user actions as agent execution trace", () => {
    render(
      <RunLogPanel
        runLog={makeRunLog({
          prompt_version: "multi-agent:offline-mission-analysis-v0.3-json-only",
          user_actions: [
            { type: "copy_raw", at: "2026-05-20T00:00:01.000Z" },
            { type: "download_raw", at: "2026-05-20T00:00:02.000Z" },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Run Log/ }));

    expect(screen.getByText("复制 Agent 执行轨迹")).toBeInTheDocument();
    expect(screen.getByText("下载 Agent 执行轨迹")).toBeInTheDocument();
    expect(screen.queryByText("复制模型原始输出")).not.toBeInTheDocument();
    expect(screen.queryByText("下载模型原始输出")).not.toBeInTheDocument();
  });
});
