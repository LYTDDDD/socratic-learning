import { describe, expect, it } from "vitest";
import { extractJsonFromOutput } from "../lib/extract-json";

describe("extractJsonFromOutput", () => {
  it("returns failure for empty string", () => {
    const result = extractJsonFromOutput("");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns failure for non-string input", () => {
    const result = extractJsonFromOutput(null as unknown as string);
    expect(result.success).toBe(false);
  });

  it("returns failure for text without JSON", () => {
    const result = extractJsonFromOutput("This is plain text without any JSON.");
    expect(result.success).toBe(false);
    expect(result.error).toContain("未找到");
  });

  it("extracts JSON from a single ```json code block", () => {
    const raw = [
      "## Analysis Report",
      "",
      "Some markdown content here.",
      "",
      "```json",
      '{"mission_review": {"original_goal": "test"}}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect(result.json).toEqual({ mission_review: { original_goal: "test" } });
    expect(result.markdown).not.toContain("```json");
    expect(result.markdown).toContain("Analysis Report");
  });

  it("extracts the LAST ```json code block when multiple exist", () => {
    const raw = [
      "## Report",
      "",
      "#### Draft Asset",
      "```json",
      '{"type": "ConceptCard", "title": "Draft"}',
      "```",
      "",
      "Some text between blocks.",
      "",
      "```json",
      '{"mission_review": {"original_goal": "real goal"}, "depth_evaluation": {}}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
    expect((result.json as Record<string, unknown>).depth_evaluation).toBeDefined();
    expect(result.markdown).toContain("Draft Asset");
    expect(result.markdown).toContain("```json");
    expect(result.markdown).toContain("ConceptCard");
    expect(result.markdown).toContain("Some text between blocks");
    expect(result.markdown).not.toContain("mission_review");
  });

  it("prefers block with mission_review over block without it", () => {
    const raw = [
      "```json",
      '{"type": "ConceptCard"}',
      "```",
      "```json",
      '{"mission_review": {}, "depth_evaluation": {}}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
  });

  it("extracts JSON from ``` code block without language tag", () => {
    const raw = [
      "## Report",
      "```",
      '{"mission_review": {"original_goal": "test"}}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
  });

  it("extracts JSON from bare object at end of text (no code block)", () => {
    const raw = [
      "## Report",
      "",
      "Some analysis text.",
      "",
      '{"mission_review": {"original_goal": "test"}, "depth_evaluation": {}}',
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
    expect(result.markdown).toContain("Report");
    expect(result.markdown).not.toContain('"mission_review"');
  });

  it("extracts JSON from a JSON-only response without markdown", () => {
    const raw = JSON.stringify({
      schema_version: "offline_mission_analysis_result.v0.3",
      output_mode: "json_only",
      mission_review: { original_goal: "test" },
      depth_evaluation: {},
      asset_decision: {},
      trace_summary: {},
    });

    const result = extractJsonFromOutput(raw);

    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).schema_version).toBe("offline_mission_analysis_result.v0.3");
    expect(result.markdown).toBe("");
  });

  it("returns failure for invalid JSON in code block", () => {
    const raw = [
      "```json",
      "{invalid json content}",
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(false);
  });

  it("returns failure for JSON array (not object)", () => {
    const raw = [
      "```json",
      '[1, 2, 3]',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(false);
  });

  it("handles deeply nested JSON in code block", () => {
    const raw = [
      "```json",
      JSON.stringify({
        mission_review: { original_goal: "test", key_turning_points: ["a", "b"] },
        depth_evaluation: { scores: { a: 1, b: 2 } },
        asset_decision: { decision: "generate", asset: { type: "ConceptCard" } },
        trace_summary: { steps: [1, 2, 3] },
      }),
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
    expect((result.json as Record<string, unknown>).depth_evaluation).toBeDefined();
    expect((result.json as Record<string, unknown>).asset_decision).toBeDefined();
    expect((result.json as Record<string, unknown>).trace_summary).toBeDefined();
  });

  it("skips code block whose content does not start with {", () => {
    const raw = [
      "```json",
      "not json at all",
      "```",
      "",
      '{"mission_review": {}}',
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
  });

  it("handles ```json with Windows-style CRLF line endings", () => {
    const raw = "## Report\r\n\r\n```json\r\n{\"mission_review\": {}}\r\n```";

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
  });

  it("handles ```json with trailing spaces after language tag", () => {
    const raw = "## Report\n\n```json  \n{\"mission_review\": {}}\n```";

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    expect((result.json as Record<string, unknown>).mission_review).toBeDefined();
  });

  it("repairs Chinese quotes inside string values by escaping them", () => {
    const raw = [
      "```json",
      '{"mission_review": {"original_goal": "\u4ECE\u201C\u5FAE\u670D\u52A1\u201D\u8F6C\u5411\u201C\u5355\u4F53\u201D"}}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toContain("\u5FAE\u670D\u52A1");
    expect(mr.original_goal).toContain("\u5355\u4F53");
  });

  it("handles mixed English and Chinese quotes in JSON values", () => {
    const raw = [
      "```json",
      '{"mission_review": {"original_goal": "\u6211\u4EE5\u4E3A\u201CuseEffect\u5C31\u662FcomponentDidMount\u201D\uFF0C\u540E\u6765\u53D1\u73B0\u4E0D\u662F"}}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toContain("useEffect");
  });

  it("handles Chinese quotes as JSON key delimiters (all Chinese quotes)", () => {
    const raw = [
      "```json",
      "{\u201Cmission_review\u201D: {\u201Coriginal_goal\u201D: \u201Ctest\u201D}}",
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toBe("test");
  });

  it("handles mixed Chinese quotes as keys with English quotes for values", () => {
    const raw = [
      "```json",
      "{\u201Cmission_review\u201D: {\"original_goal\": \"test\"}}",
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toBe("test");
  });

  it("handles ```json without newline after language tag", () => {
    const raw = "## Report\n\n```json {\"mission_review\": {\"original_goal\": \"test\"}}\n```";

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toBe("test");
  });

  it("handles JSON with single quotes instead of double quotes", () => {
    const raw = [
      "```json",
      "{'mission_review': {'original_goal': 'test'}}",
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toBe("test");
  });

  it("handles JSON with trailing commas", () => {
    const raw = [
      "```json",
      '{"mission_review": {"original_goal": "test"},}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const mr = (result.json as Record<string, unknown>).mission_review as Record<string, unknown>;
    expect(mr.original_goal).toBe("test");
  });

  it("handles Chinese quotes in values with trailing commas", () => {
    const raw = [
      "```json",
      '{"uncertainties": ["\u6838\u5FC3\u4E0D\u786E\u5B9A\u6027\uFF1A\u9664\u201C\u6750\u6599\u4E0D\u8DB3\u201D\u5916\u7684\u7F6E\u4FE1\u5EA6\u90FD\u6781\u4F4E\u3002",],}',
      "```",
    ].join("\n");

    const result = extractJsonFromOutput(raw);
    expect(result.success).toBe(true);
    const uncertainties = (result.json as Record<string, unknown>).uncertainties as string[];
    expect(uncertainties[0]).toContain("\u6750\u6599\u4E0D\u8DB3");
  });
});
