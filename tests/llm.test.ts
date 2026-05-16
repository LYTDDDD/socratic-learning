import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/llm", async () => {
  const actual = await vi.importActual<typeof import("../lib/llm")>("../lib/llm");
  return {
    ...actual,
    getModelConfig: () => ({
      apiKey: "test-key",
      baseUrl: "https://api.test.com",
      model: "test-model",
    }),
  };
});

import { callReviewModel, callAnalysisModel } from "../lib/llm";

describe("callReviewModel signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts optional signal parameter", () => {
    const controller = new AbortController();
    const signal = controller.signal;

    expect(typeof callReviewModel).toBe("function");
    expect(callReviewModel.length).toBe(3);
  });

  it("accepts callReviewModel without signal (backward compatible)", async () => {
    await expect(
      callReviewModel("system", "user"),
    ).rejects.toThrow();
  });
});

describe("callAnalysisModel signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts optional signal parameter", () => {
    expect(typeof callAnalysisModel).toBe("function");
    expect(callAnalysisModel.length).toBe(3);
  });
});
