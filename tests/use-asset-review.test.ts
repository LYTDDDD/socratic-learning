import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetReview } from "../lib/use-asset-review";
import { renderHook, act } from "@testing-library/react";
import { loadReviewRecords } from "../lib/review-record-store";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeAsset() {
  return {
    asset_id: "asset_test_1",
    title: "Test Asset",
    core_insight: "Core insight text",
    original_judgment: "Original judgment",
    revised_judgment: "Revised judgment",
    my_understanding: "My understanding",
    transferable_value: "Transferable value",
    review_questions: ["Q1?"],
    connection_questions: [] as string[],
    application_questions: [] as string[],
    asset_type: "MethodCard" as const,
    status: "confirmed" as const,
    maturity: "Reference" as const,
    confidence: 0.8,
    source_run_id: "run_1",
    source_mission: "",
    created_at: "2026-05-15T00:00:00.000Z",
    special_fields: {},
    connection_layer: {
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
    usage_evidence: [],
    ai_generated_summary: "",
    versions: [],
    current_version_id: "",
    problem_it_solves: "",
    my_judgment: "",
    full_package: {},
    user_built_connections: {
      related_concepts: [],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    ai_generated_draft: {},
    user_final_asset: null,
  };
}

describe("useAssetReview", () => {
  it("initializes with null reviewFlow", () => {
    const { result } = renderHook(() => useAssetReview());
    expect(result.current.reviewFlow).toBeNull();
  });

  it("transitions through loading_questions to answering", async () => {
    let resolveQuestions: (v: unknown) => void;
    const questionsPromise = new Promise((resolve) => {
      resolveQuestions = resolve;
    });
    const mockFetch = vi.fn().mockImplementation(() => questionsPromise);
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    act(() => {
      result.current.startReview(asset);
    });

    expect(result.current.reviewFlow).not.toBeNull();
    expect(result.current.reviewFlow!.phase).toBe("loading_questions");
    expect(result.current.reviewFlow!.asset.asset_id).toBe("asset_test_1");

    await act(async () => {
      resolveQuestions!({
        json: () => Promise.resolve({ phase: "questions", questions: ["Q1?", "Q2?"], error: null }),
      });
    });

    expect(result.current.reviewFlow!.phase).toBe("answering");
    if (result.current.reviewFlow!.phase === "answering") {
      expect(result.current.reviewFlow!.questions).toEqual(["Q1?", "Q2?"]);
      expect(result.current.reviewFlow!.answers).toEqual(["", ""]);
    }
  });

  it("transitions to error on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ phase: "questions", questions: [], error: "API error" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    expect(result.current.reviewFlow!.phase).toBe("error");
    if (result.current.reviewFlow!.phase === "error") {
      expect(result.current.reviewFlow!.message).toBe("API error");
    }
  });

  it("transitions to error when no questions generated", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ phase: "questions", questions: [], error: null }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    expect(result.current.reviewFlow!.phase).toBe("error");
    if (result.current.reviewFlow!.phase === "error") {
      expect(result.current.reviewFlow!.message).toBe("AI 未生成评估问题。");
    }
  });

  it("transitions to error on network exception", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    expect(result.current.reviewFlow!.phase).toBe("error");
    if (result.current.reviewFlow!.phase === "error") {
      expect(result.current.reviewFlow!.message).toBe("Network failure");
    }
  });

  it("resets reviewFlow on exitReview", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    act(() => {
      result.current.exitReview();
    });

    expect(result.current.reviewFlow).toBeNull();
  });

  it("ignores pending question response after exitReview", async () => {
    let resolveQuestions: (v: unknown) => void;
    const questionsPromise = new Promise((resolve) => {
      resolveQuestions = resolve;
    });
    const mockFetch = vi.fn().mockImplementation(() => questionsPromise);
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    act(() => {
      void result.current.startReview(asset);
    });

    act(() => {
      result.current.exitReview();
    });

    await act(async () => {
      resolveQuestions!({
        json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
      });
      await questionsPromise;
    });

    expect(result.current.reviewFlow).toBeNull();
  });

  it("ignores older question response when a newer review starts", async () => {
    let resolveFirst: (v: unknown) => void;
    let resolveSecond: (v: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    const mockFetch = vi.fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise);
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const firstAsset = makeAsset();
    const secondAsset = { ...makeAsset(), asset_id: "asset_test_2", title: "Second Asset" };

    act(() => {
      void result.current.startReview(firstAsset);
      void result.current.startReview(secondAsset);
    });

    await act(async () => {
      resolveSecond!({
        json: () => Promise.resolve({ phase: "questions", questions: ["Q2?"], error: null }),
      });
      await secondPromise;
    });

    expect(result.current.reviewFlow!.phase).toBe("answering");
    expect(result.current.reviewFlow!.asset.asset_id).toBe("asset_test_2");

    await act(async () => {
      resolveFirst!({
        json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
      });
      await firstPromise;
    });

    expect(result.current.reviewFlow!.phase).toBe("answering");
    expect(result.current.reviewFlow!.asset.asset_id).toBe("asset_test_2");
  });

  it("updateAnswer modifies answers array", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ phase: "questions", questions: ["Q1?", "Q2?"], error: null }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    expect(result.current.reviewFlow!.phase).toBe("answering");

    act(() => {
      result.current.updateAnswer(0, "First answer");
    });

    if (result.current.reviewFlow!.phase === "answering") {
      expect(result.current.reviewFlow!.answers[0]).toBe("First answer");
      expect(result.current.reviewFlow!.answers[1]).toBe("");
    }

    act(() => {
      result.current.updateAnswer(1, "Second answer");
    });

    if (result.current.reviewFlow!.phase === "answering") {
      expect(result.current.reviewFlow!.answers[1]).toBe("Second answer");
    }
  });

  it("completes full review flow and calls onRecordSaved", async () => {
    const onRecordSaved = vi.fn();

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          phase: "feedback",
          feedback: [{ question: "Q1?", answer: "My answer", evaluation: "good", comment: "Nice" }],
          overallAssessment: "Good understanding",
          maturitySuggestion: { current: "Reference", suggested: "Understanding", reason: "Shows comprehension" },
          error: null,
        }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview(onRecordSaved));
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    expect(result.current.reviewFlow!.phase).toBe("answering");

    act(() => {
      result.current.updateAnswer(0, "My answer");
    });

    await act(async () => {
      await result.current.submitAnswers();
    });

    expect(result.current.reviewFlow!.phase).toBe("result");
    if (result.current.reviewFlow!.phase === "result") {
      expect(result.current.reviewFlow!.feedback).toHaveLength(1);
      expect(result.current.reviewFlow!.feedback[0].evaluation).toBe("good");
      expect(result.current.reviewFlow!.overallAssessment).toBe("Good understanding");
      expect(result.current.reviewFlow!.maturitySuggestion).not.toBeNull();
      expect(result.current.reviewFlow!.maturitySuggestion!.suggested).toBe("Understanding");
      expect(result.current.reviewFlow!.recordSaved).toBe(true);
    }

    expect(onRecordSaved).toHaveBeenCalledTimes(1);
  });

  it("handles submitAnswers API error", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ phase: "feedback", feedback: [], error: "Feedback generation failed" }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    act(() => {
      result.current.updateAnswer(0, "My answer");
    });

    await act(async () => {
      await result.current.submitAnswers();
    });

    expect(result.current.reviewFlow!.phase).toBe("error");
    if (result.current.reviewFlow!.phase === "error") {
      expect(result.current.reviewFlow!.message).toBe("Feedback generation failed");
    }
  });

  it("does not submit feedback twice from the same render", async () => {
    let resolveFeedback: (v: unknown) => void;
    const feedbackPromise = new Promise((resolve) => {
      resolveFeedback = resolve;
    });
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
      })
      .mockImplementationOnce(() => feedbackPromise);
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    act(() => {
      result.current.updateAnswer(0, "My answer");
    });

    const submit = result.current.submitAnswers;
    act(() => {
      void submit();
      void submit();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFeedback!({
        json: () => Promise.resolve({
          phase: "feedback",
          feedback: [{ question: "Q1?", answer: "My answer", evaluation: "good", comment: "Nice" }],
          overallAssessment: "Good",
          maturitySuggestion: null,
          error: null,
        }),
      });
      await feedbackPromise;
    });

    expect(loadReviewRecords()).toHaveLength(1);
  });

  it("does not save a review record when feedback is empty", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          phase: "feedback",
          feedback: [],
          overallAssessment: "",
          maturitySuggestion: null,
          error: null,
        }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    act(() => {
      result.current.updateAnswer(0, "My answer");
    });

    await act(async () => {
      await result.current.submitAnswers();
    });

    expect(result.current.reviewFlow!.phase).toBe("error");
    expect(loadReviewRecords()).toHaveLength(0);
  });

  it("handles submitAnswers network exception", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          json: () => Promise.resolve({ phase: "questions", questions: ["Q1?"], error: null }),
        });
      }
      return Promise.reject(new Error("Connection lost"));
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAssetReview());
    const asset = makeAsset();

    await act(async () => {
      await result.current.startReview(asset);
    });

    act(() => {
      result.current.updateAnswer(0, "My answer");
    });

    await act(async () => {
      await result.current.submitAnswers();
    });

    expect(result.current.reviewFlow!.phase).toBe("error");
    if (result.current.reviewFlow!.phase === "error") {
      expect(result.current.reviewFlow!.message).toBe("Connection lost");
    }
  });
});
