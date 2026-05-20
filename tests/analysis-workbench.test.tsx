import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisWorkbench } from "../components/AnalysisWorkbench";
import type { AnalyzeResponse } from "../lib/analyze-types";
import { loadHistory, saveToHistory, type HistoryEntry } from "../lib/history-store";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeResponse(runId: string): AnalyzeResponse {
  return {
    markdown: "# Report",
    json: { mission_review: { original_goal: "test goal" } },
    raw: "raw model text",
    parseStatus: "success",
    error: null,
    runLog: {
      run_id: runId,
      created_at: "2026-05-20T00:00:00.000Z",
      input_snapshot: { originalGoal: "test goal", conversation: "test conversation" },
      prompt_version: "offline-mission-analysis-v0.3-json-only",
      model_name: "test-model",
      request_status: "success",
      parse_status: "success",
      duration_ms: 120,
      error_message: null,
    },
  };
}

function makeHistoryEntry(runId: string): HistoryEntry {
  return {
    run_id: runId,
    created_at: "2026-05-20T00:00:00.000Z",
    input_snapshot: { originalGoal: "test goal", conversation: "test conversation" },
    analyzeResponse: makeResponse(runId),
    status: "draft",
  };
}

describe("AnalysisWorkbench", () => {
  it("shows model original output tab and records copy_raw when copying it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    saveToHistory(makeHistoryEntry("run_workbench_raw_copy"));

    render(<AnalysisWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: /run_workbench_raw_/ }));
    fireEvent.click(screen.getByRole("button", { name: "原始输出" }));

    expect(screen.getByRole("heading", { name: "模型原始输出" })).toBeInTheDocument();
    expect(screen.getByText("raw model text")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "复制" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("raw model text");
      expect(loadHistory()[0].analyzeResponse.runLog?.user_actions?.[0]?.type).toBe("copy_raw");
    });
  });
});
