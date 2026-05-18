import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWorkspace } from "../components/ChatWorkspace";
import { addMessageToSession, createChatSession, getSessionById } from "../lib/chat-store";

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
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChatWorkspace", () => {
  it("shows conversation workspace stats and review handoff", async () => {
    const session = createChatSession("复盘候选对话", "mission_chat_1");
    expect(session).not.toBeNull();
    addMessageToSession(session!.id, { role: "user", content: "我想判断学生是否理解顶点式" });
    addMessageToSession(session!.id, { role: "assistant", content: "可以先看他是否能解释参数含义" });

    render(<ChatWorkspace currentMissionId={null} />);

    fireEvent.click(await screen.findByText("复盘候选对话"));

    expect(screen.getByText("Conversation Workspace")).toBeInTheDocument();
    expect(screen.getByText("Review Handoff")).toBeInTheDocument();
    expect(screen.getByText("sessions").parentElement).toHaveTextContent("1");
    expect(screen.getByText("missions").parentElement).toHaveTextContent("1");
    expect(screen.getByText("turns").parentElement).toHaveTextContent("2");
  });

  it("hands the active conversation to offline analysis", async () => {
    const session = createChatSession("待复盘对话", "mission_handoff");
    expect(session).not.toBeNull();
    addMessageToSession(session!.id, { role: "user", content: "这段对话需要复盘" });
    const onReviewTriggered = vi.fn();

    render(<ChatWorkspace currentMissionId={null} onReviewTriggered={onReviewTriggered} />);

    fireEvent.click(await screen.findByText("待复盘对话"));
    fireEvent.click(screen.getByRole("button", { name: /发送到离线分析/ }));

    expect(onReviewTriggered).toHaveBeenCalledWith(session!.id, "mission_handoff");
    expect(getSessionById(session!.id)!.messages[0].reviewTriggered).toBe(true);
    expect(screen.getByText("已发送到离线分析，可重新带入最新内容。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重新发送到离线分析/ })).toBeInTheDocument();
  });

  it("shows API error details when chat request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "缺少 OPENAI_API_KEY" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<ChatWorkspace currentMissionId={null} />);

    fireEvent.click(screen.getAllByRole("button", { name: "新建对话" })[0]);

    const input = await screen.findByPlaceholderText("输入消息…");
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getAllByText("请求失败：缺少 OPENAI_API_KEY").length).toBeGreaterThan(0);
    });
  });
});
