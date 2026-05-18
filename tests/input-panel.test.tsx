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
});
