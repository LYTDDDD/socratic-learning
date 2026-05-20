import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InputPanel } from "../components/InputPanel";

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
  vi.unstubAllGlobals();
});

describe("InputPanel", () => {
  it("shows the source conversation when input is handed off from chat", () => {
    render(
      <InputPanel
        initialInputOverride={{
          originalGoal: "请帮我复盘这段学习对话",
          conversation: "用户：学生能说出公式，但解释不出为什么。",
        }}
        initialInputSource={{
          title: "复盘候选对话",
          messageCount: 2,
          handedOffAt: "2026-05-18T07:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Review Handoff")).toBeInTheDocument();
    expect(screen.getByText(/已从对话带入：复盘候选对话/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("请帮我复盘这段学习对话")).toBeInTheDocument();
    expect(screen.getByDisplayValue("用户：学生能说出公式，但解释不出为什么。")).toBeInTheDocument();
  });

  it("aborts an in-flight analyze request when the user cancels", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    render(<InputPanel />);

    fireEvent.change(screen.getByPlaceholderText("一开始想解决的问题或判断目标。"), {
      target: { value: "测试取消分析请求" },
    });
    fireEvent.change(screen.getByPlaceholderText("粘贴完整对话或关键片段。"), {
      target: { value: "用户：测试取消按钮。" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    const cancelButton = await screen.findByRole("button", { name: "取消" });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(requestSignal?.aborted).toBe(true);
      expect(screen.getByText("分析已取消。")).toBeInTheDocument();
    });
  });

  it("labels completed multi-agent SSE raw data as agent execution trace", async () => {
    const doneResult = {
      markdown: "# Report",
      json: { mission_review: {} },
      raw: JSON.stringify({ steps: [], supervisorDecision: "test" }),
      parseStatus: "success",
      error: null,
      runLog: {
        run_id: "run_input_agent_trace",
        created_at: "2026-05-20T00:00:00.000Z",
        input_snapshot: { originalGoal: "goal", conversation: "conversation" },
        prompt_version: "multi-agent:offline-mission-analysis-v0.3-json-only",
        model_name: "test-model",
        request_status: "success",
        parse_status: "success",
        duration_ms: 100,
        error_message: null,
      },
    };
    const streamText = `event: done\ndata: ${JSON.stringify(doneResult)}\n\n`;

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new TextEncoder().encode(streamText), {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        ),
      ),
    );

    const onAnalyzeFinish = vi.fn();
    render(<InputPanel onAnalyzeFinish={onAnalyzeFinish} />);

    fireEvent.change(screen.getByPlaceholderText("一开始想解决的问题或判断目标。"), {
      target: { value: "测试多 Agent 完成提示" },
    });
    fireEvent.change(screen.getByPlaceholderText("粘贴完整对话或关键片段。"), {
      target: { value: "用户：请复盘这段学习对话。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "多 Agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(screen.getByText("多 Agent 分析完成，已收到 Agent 执行轨迹。")).toBeInTheDocument();
      expect(screen.queryByText("模型调用完成，已收到模型原始输出。")).not.toBeInTheDocument();
      expect(onAnalyzeFinish).toHaveBeenCalledWith(expect.objectContaining({ raw: doneResult.raw }));
    });
  });
});
