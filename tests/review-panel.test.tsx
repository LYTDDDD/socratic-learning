import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ReviewPanel } from "../components/ReviewPanel";
import { saveAndConfirmAsset } from "../lib/asset-store";
import type { CognitiveAsset } from "../lib/extract-asset";
import { saveReviewRecord } from "../lib/review-record-store";

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

function makeAsset(overrides: Partial<CognitiveAsset>): CognitiveAsset {
  return {
    asset_id: "asset_default",
    title: "Default Asset",
    core_insight: "Core insight",
    original_judgment: "Original judgment",
    revised_judgment: "Revised judgment",
    my_understanding: "My understanding",
    transferable_value: "Transferable value",
    review_questions: [],
    connection_questions: [],
    application_questions: [],
    asset_type: "MethodCard",
    status: "confirmed",
    maturity: "Reference",
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
    ...overrides,
  };
}

function saveRecord(assetId: string, assetTitle: string) {
  saveReviewRecord({
    assetId,
    assetTitle,
    assetMaturityBefore: "Reference",
    assetMaturityAfter: "Reference",
    reviewTypes: ["asset_card"],
    questions: ["Q"],
    answers: ["A"],
    feedback: [{ question: "Q", answer: "A", evaluation: "good", comment: "ok" }],
    overallAssessment: "ok",
    maturitySuggestion: null,
    result: "good",
    maturityUpgradeSuggested: false,
    assetUpdateSuggested: false,
    reviewedAt: "2026-05-15T00:00:00.000Z",
  });
}

describe("ReviewPanel", () => {
  it("filters assets and records by currentMissionId", async () => {
    saveAndConfirmAsset(makeAsset({
      asset_id: "asset_mission_a",
      title: "Mission A Asset",
      source_mission: "mission_a",
    }));
    saveAndConfirmAsset(makeAsset({
      asset_id: "asset_mission_b",
      title: "Mission B Asset",
      source_mission: "mission_b",
    }));
    saveRecord("asset_mission_a", "Mission A Asset");
    saveRecord("asset_mission_b", "Mission B Asset");

    render(<ReviewPanel refreshKey={0} currentMissionId="mission_a" />);

    await waitFor(() => {
      expect(screen.getAllByText("Mission A Asset").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Mission B Asset")).not.toBeInTheDocument();
  });

  it("shows all assets and records when no mission is selected", async () => {
    saveAndConfirmAsset(makeAsset({
      asset_id: "asset_mission_a",
      title: "Mission A Asset",
      source_mission: "mission_a",
    }));
    saveAndConfirmAsset(makeAsset({
      asset_id: "asset_mission_b",
      title: "Mission B Asset",
      source_mission: "mission_b",
    }));
    saveRecord("asset_mission_a", "Mission A Asset");
    saveRecord("asset_mission_b", "Mission B Asset");

    render(<ReviewPanel refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getAllByText("Mission A Asset").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Mission B Asset").length).toBeGreaterThan(0);
    });
  });
});
