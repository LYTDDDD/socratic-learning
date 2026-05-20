import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AssetLibrary } from "../components/AssetLibrary";
import { saveAndConfirmAsset } from "../lib/asset-store";
import type { CognitiveAsset } from "../lib/extract-asset";
import { saveKnowledgeSubCard } from "../lib/knowledge-subcard";

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

function makeAsset(overrides: Partial<CognitiveAsset> = {}): CognitiveAsset {
  return {
    asset_id: "asset_default",
    created_at: "2026-05-15T00:00:00.000Z",
    source_run_id: "run_default",
    status: "confirmed",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "Default Mother Card",
    ai_generated_summary: "",
    core_insight: "Use a worked example before abstraction.",
    my_understanding: "Example first, abstraction second.",
    problem_it_solves: "",
    original_judgment: "Start with the rule.",
    revised_judgment: "Start with the case.",
    my_judgment: "",
    transferable_value: "Useful when a learner is stuck.",
    review_questions: ["When should I use the worked example first?"],
    source_mission: "",
    confidence: 0.8,
    special_fields: {},
    full_package: {},
    connection_questions: [],
    application_questions: [],
    user_built_connections: {
      related_concepts: ["scaffolding"],
      related_assets: [],
      mental_models: ["concrete to abstract"],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: ["debugging a misconception"],
      open_questions: [],
    },
    ai_suggested_connections: {
      related_concepts: ["examples"],
      related_assets: [],
      mental_models: [],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    connection_layer: {
      related_concepts: ["scaffolding"],
      related_assets: [],
      mental_models: ["concrete to abstract"],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: ["debugging a misconception"],
      open_questions: [],
    },
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    current_version_id: "ver_1",
    versions: [],
    ...overrides,
  };
}

describe("AssetLibrary", () => {
  it("summarizes mother cards, subcards, connections, and review readiness", async () => {
    saveAndConfirmAsset(makeAsset());
    saveKnowledgeSubCard({
      id: "subcard_1",
      parentAssetId: "asset_default",
      title: "Worked example trigger",
      markdownContent: "Use a concrete worked example.",
      source: "user_created",
      status: "saved",
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    render(<AssetLibrary refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Mother Cards").parentElement).toHaveTextContent("1");
      expect(screen.getByText("SubCards").parentElement).toHaveTextContent("1");
      expect(screen.getByText("Connections").parentElement).toHaveTextContent("3");
      expect(screen.getByText("Review Ready").parentElement).toHaveTextContent("1");
    });
  });

  it("opens a mother card detail with user-first connection context", async () => {
    saveAndConfirmAsset(makeAsset({ title: "Example-first Teaching" }));

    render(<AssetLibrary refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Example-first Teaching")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Example-first Teaching"));

    expect(screen.getAllByText("Mother Card").length).toBeGreaterThan(0);
    expect(screen.getByText("User-first Connection Layer")).toBeInTheDocument();
    expect(screen.getByText("Review Prompts")).toBeInTheDocument();
  });

  it("does not count or display legacy connection_layer values as user-built connections", async () => {
    saveAndConfirmAsset(makeAsset({
      title: "Legacy Connection Layer",
      user_built_connections: {
        related_concepts: [],
        related_assets: [],
        mental_models: [],
        prior_experience: [],
        opposite_cases: [],
        application_scenarios: [],
        open_questions: [],
      },
      connection_layer: {
        related_concepts: ["legacy concept"],
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
    }));

    render(<AssetLibrary refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Connections").parentElement).toHaveTextContent("0");
      expect(screen.getByText(/连接 0/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Legacy Connection Layer"));

    expect(screen.queryByText("User-first Connection Layer")).not.toBeInTheDocument();
    expect(screen.queryByText("legacy concept")).not.toBeInTheDocument();
  });
});
