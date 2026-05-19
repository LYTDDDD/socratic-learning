import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPanel } from "../components/HistoryPanel";
import { MissionPanel } from "../components/MissionPanel";
import type { AnalyzeResponse } from "../lib/analyze-types";
import { saveAndConfirmAsset } from "../lib/asset-store";
import type { CognitiveAsset } from "../lib/extract-asset";
import { loadHistory, saveToHistory, type HistoryEntry } from "../lib/history-store";
import { assignReportToMission, saveMission } from "../lib/mission-store";

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
});

function makeResponse(runId: string): AnalyzeResponse {
  return {
    markdown: "# report",
    json: { mission_review: {} },
    raw: null,
    parseStatus: "success",
    error: null,
    runLog: {
      run_id: runId,
      created_at: "2026-05-18T00:00:00.000Z",
      input_snapshot: { originalGoal: "判断学生是否理解顶点式", conversation: "学生对话" },
      prompt_version: "offline-mission-analysis-v0.2",
      model_name: "test-model",
      request_status: "success",
      parse_status: "success",
      duration_ms: 120,
      error_message: null,
    },
  };
}

function makeHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  const runId = overrides.run_id ?? "run_workflow_1";
  return {
    run_id: runId,
    created_at: "2026-05-18T00:00:00.000Z",
    input_snapshot: { originalGoal: "判断学生是否理解顶点式", conversation: "学生对话" },
    analyzeResponse: makeResponse(runId),
    status: "draft",
    ...overrides,
  };
}

function makeAsset(sourceMission: string): CognitiveAsset {
  return {
    asset_id: "asset_workflow_1",
    created_at: "2026-05-18T00:00:00.000Z",
    source_run_id: "run_workflow_1",
    status: "confirmed",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "顶点式诊断",
    ai_generated_summary: "",
    core_insight: "先看学生能否解释参数意义。",
    my_understanding: "",
    problem_it_solves: "",
    original_judgment: "",
    revised_judgment: "",
    my_judgment: "",
    transferable_value: "",
    review_questions: [],
    source_mission: sourceMission,
    confidence: 0.8,
    special_fields: {},
    full_package: {},
    connection_questions: [],
    application_questions: [],
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    ai_suggested_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    connection_layer: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    current_version_id: "",
    versions: [],
  };
}

describe("workflow navigation panels", () => {
  it("shows report history workflow stats", async () => {
    saveToHistory(makeHistoryEntry({ run_id: "run_a", status: "draft" }));
    saveToHistory(makeHistoryEntry({ run_id: "run_b", status: "reviewed" }));

    render(<HistoryPanel onSelect={vi.fn()} refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Report History")).toBeInTheDocument();
      expect(screen.getByText("reports").parentElement).toHaveTextContent("2");
      expect(screen.getByText("to review").parentElement).toHaveTextContent("1");
      expect(screen.getByText("reviewed").parentElement).toHaveTextContent("1");
    });
  });

  it("passes reviewed status when selecting a draft history entry", async () => {
    saveToHistory(makeHistoryEntry({ run_id: "run_draft_status", status: "draft" }));
    const onSelect = vi.fn();

    render(<HistoryPanel onSelect={onSelect} refreshKey={0} />);

    fireEvent.click(await screen.findByRole("button", { name: /run_draft_status/ }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        runLog: expect.objectContaining({ run_id: "run_draft_status" }),
      }),
      "run_draft_status",
      "reviewed",
    );
    expect(loadHistory().find((entry) => entry.run_id === "run_draft_status")?.status).toBe("reviewed");
  });

  it("notifies parent when discarding and restoring a history entry", async () => {
    saveToHistory(makeHistoryEntry({ run_id: "run_status_sync", status: "reviewed" }));
    const onStatusChange = vi.fn();

    const { container } = render(
      <HistoryPanel onSelect={vi.fn()} onStatusChange={onStatusChange} refreshKey={0} />,
    );

    await screen.findByRole("button", { name: /run_status_sync/ });
    const discardButton = container.querySelector('button[title="标记为已废弃"]');
    expect(discardButton).not.toBeNull();
    fireEvent.click(discardButton!);

    expect(onStatusChange).toHaveBeenCalledWith("run_status_sync", "discarded");
    expect(loadHistory().find((entry) => entry.run_id === "run_status_sync")?.status).toBe("discarded");

    fireEvent.click(await screen.findByRole("button", { name: /显示已废弃/ }));
    const restoreButton = container.querySelector('button[title="恢复"]');
    expect(restoreButton).not.toBeNull();
    fireEvent.click(restoreButton!);

    expect(onStatusChange).toHaveBeenCalledWith("run_status_sync", "draft");
    expect(loadHistory().find((entry) => entry.run_id === "run_status_sync")?.status).toBe("draft");
  });

  it("records a user action when copying markdown from history", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    saveToHistory(makeHistoryEntry({ run_id: "run_history_md_copy", status: "reviewed" }));
    const onUserActionRecorded = vi.fn();

    render(<HistoryPanel onSelect={vi.fn()} onUserActionRecorded={onUserActionRecorded} refreshKey={0} />);

    fireEvent.click(await screen.findByRole("button", { name: "M" }));

    await waitFor(() => {
      const actions = loadHistory()[0].analyzeResponse.runLog?.user_actions ?? [];
      expect(actions[0]?.type).toBe("copy_markdown");
      expect(onUserActionRecorded).toHaveBeenCalledWith("run_history_md_copy", actions[0]);
    });
    expect(writeText).toHaveBeenCalledWith("# report");
  });

  it("records a user action when copying json from history", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    saveToHistory(makeHistoryEntry({ run_id: "run_history_json_copy", status: "reviewed" }));

    render(<HistoryPanel onSelect={vi.fn()} refreshKey={0} />);

    fireEvent.click(await screen.findByRole("button", { name: "J" }));

    await waitFor(() => {
      expect(loadHistory()[0].analyzeResponse.runLog?.user_actions?.[0]?.type).toBe("copy_json");
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("run_history_json_copy"));
  });

  it("shows mission workspace workflow stats", async () => {
    const mission = saveMission({
      title: "函数理解诊断",
      description: "组织离线分析和资产沉淀",
      status: "active",
    });
    expect(mission).not.toBeNull();
    assignReportToMission(mission!.id, "run_workflow_1");
    saveToHistory(makeHistoryEntry({ run_id: "run_workflow_1" }));
    saveAndConfirmAsset(makeAsset(mission!.id));

    render(<MissionPanel currentMissionId={mission!.id} onSelectMission={vi.fn()} refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Mission Workspace")).toBeInTheDocument();
      expect(screen.getByText("active").parentElement).toHaveTextContent("1");
      expect(screen.getByText("reports").parentElement).toHaveTextContent("1");
      expect(screen.getByText("assets").parentElement).toHaveTextContent("1");
      expect(screen.getByText("函数理解诊断")).toBeInTheDocument();
    });
  });
});
