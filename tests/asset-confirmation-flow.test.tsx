import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AssetDraftPanel } from "../components/AssetDraftPanel";
import { AssetLibrary } from "../components/AssetLibrary";
import { ReviewPanel } from "../components/ReviewPanel";
import { loadAssets } from "../lib/asset-store";
import type { CognitiveAsset } from "../lib/extract-asset";

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

function makeCandidateAsset(): CognitiveAsset {
  return {
    asset_id: "asset_candidate_1",
    created_at: "2026-05-18T00:00:00.000Z",
    source_run_id: "run_candidate_1",
    status: "draft",
    asset_type: "MethodCard",
    maturity: "Reference",
    title: "Worked Example Before Abstraction",
    ai_generated_summary: "Use a worked example before naming the abstract rule.",
    core_insight: "Concrete evidence should precede abstraction when a learner is stuck.",
    my_understanding: "Start from the learner's visible reasoning, then name the rule.",
    problem_it_solves: "The learner can repeat a formula but cannot explain why it works.",
    original_judgment: "Ask for the formula again.",
    revised_judgment: "Ask for an example that explains the formula.",
    my_judgment: "The asset is useful when explanation is weaker than recall.",
    transferable_value: "Works for math, debugging, and conceptual review.",
    review_questions: ["When should I ask for a worked example first?"],
    source_mission: "",
    confidence: 0.82,
    special_fields: {},
    full_package: {},
    connection_questions: ["What prior case does this resemble?"],
    application_questions: ["Where can I apply this next?"],
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
      related_concepts: ["scaffolding"],
      related_assets: [],
      mental_models: ["concrete to abstract"],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: [],
      open_questions: [],
    },
    connection_layer: {
      related_concepts: ["worked examples"],
      related_assets: [],
      mental_models: ["concrete to abstract"],
      prior_experience: [],
      opposite_cases: [],
      application_scenarios: ["reviewing shallow formula recall"],
      open_questions: [],
    },
    usage_evidence: [],
    ai_generated_draft: {},
    user_final_asset: null,
    current_version_id: "ver_candidate_1",
    versions: [],
  };
}

function ConfirmationFlowHarness() {
  const [refreshKey, setRefreshKey] = useState(0);
  const asset = makeCandidateAsset();

  return (
    <div>
      <AssetDraftPanel
        asset={asset}
        currentMissionId="mission_asset_flow"
        onConfirm={() => setRefreshKey((key) => key + 1)}
        onDiscard={() => {}}
      />
      <AssetLibrary refreshKey={refreshKey} />
      <ReviewPanel refreshKey={refreshKey} />
    </div>
  );
}

describe("asset confirmation flow", () => {
  it("refreshes asset library and review mode after confirming a candidate", async () => {
    render(<ConfirmationFlowHarness />);

    expect(screen.getByText("Asset Candidate Package")).toBeInTheDocument();
    expect(screen.getByText("Mother Cards").parentElement).toHaveTextContent("0");
    expect(screen.getByText("Review Ready").parentElement).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "确认入库为母卡" }));

    await waitFor(() => {
      expect(screen.getByText("资产已确认入库")).toBeInTheDocument();
      expect(screen.getByText("Mother Cards").parentElement).toHaveTextContent("1");
      expect(screen.getByText("Review Ready").parentElement).toHaveTextContent("1");
      const reviewItem = screen.getByRole("button", { name: "开始复习" }).closest("li");
      expect(reviewItem).not.toBeNull();
      expect(within(reviewItem!).getByText("Worked Example Before Abstraction")).toBeInTheDocument();
    });

    const [saved] = loadAssets();
    expect(saved.status).toBe("confirmed");
    expect(saved.source_mission).toBe("mission_asset_flow");
    expect(saved.user_final_asset).not.toBeNull();
    expect(saved.user_built_connections.related_concepts).toEqual(["worked examples"]);
  });
});
