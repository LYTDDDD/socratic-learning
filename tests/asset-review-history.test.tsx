import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssetReviewHistory } from "../components/AssetReviewHistory";
import type { ReviewRecord } from "../lib/review-record-store";

afterEach(() => {
  cleanup();
});

function makeRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "review_default",
    assetId: "asset_default",
    assetTitle: "Default Asset",
    reviewedAt: "2026-05-15T00:00:00.000Z",
    assetMaturityBefore: "Reference",
    assetMaturityAfter: "Reference",
    reviewTypes: ["asset_card"],
    questions: ["Q"],
    answers: ["A"],
    feedback: [{ question: "What changed?", answer: "Answer", evaluation: "good", comment: "ok" }],
    overallAssessment: "Overall assessment",
    maturitySuggestion: null,
    result: "good",
    maturityUpgradeSuggested: false,
    assetUpdateSuggested: false,
    createdAt: "2026-05-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("AssetReviewHistory", () => {
  it("renders nothing when records are empty", () => {
    const { container } = render(<AssetReviewHistory records={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders collapsed count and expands review details", () => {
    render(<AssetReviewHistory records={[
      makeRecord({
        result: "partial",
        maturityUpgradeSuggested: true,
        overallAssessment: "Needs one sharper example",
        feedback: [{ question: "Where can this transfer?", answer: "A", evaluation: "partial", comment: "ok" }],
      }),
    ]} />);

    expect(screen.getByText("复习记录")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 次" })).toBeInTheDocument();
    expect(screen.queryByText("Needs one sharper example")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1 次" }));

    expect(screen.getByText("部分理解")).toBeInTheDocument();
    expect(screen.getByText("建议升级")).toBeInTheDocument();
    expect(screen.getByText("Needs one sharper example")).toBeInTheDocument();
    expect(screen.getByText("Where can this transfer?")).toBeInTheDocument();
  });

  it("renders all result labels after expansion", () => {
    render(<AssetReviewHistory records={[
      makeRecord({ id: "good", result: "good", feedback: [] }),
      makeRecord({ id: "partial", result: "partial", feedback: [] }),
      makeRecord({ id: "needs_work", result: "needs_work", feedback: [] }),
    ]} />);

    fireEvent.click(screen.getByRole("button", { name: "3 次" }));

    expect(screen.getByText("理解到位")).toBeInTheDocument();
    expect(screen.getByText("部分理解")).toBeInTheDocument();
    expect(screen.getByText("需要补充")).toBeInTheDocument();
  });
});
