import { describe, expect, it } from "vitest";

type TraceSummaryData = {
  mission_detected?: boolean | string;
  analysis_path?: string;
  key_evidence_used?: string | string[];
  policy_checks?: string | string[];
  uncertainties?: string | string[];
};

function extractTraceSummary(json: unknown): TraceSummaryData | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const ts = obj.trace_summary;
  if (!ts || typeof ts !== "object") return null;
  const t = ts as Record<string, unknown>;
  return {
    mission_detected: t.mission_detected as boolean | string | undefined,
    analysis_path: t.analysis_path as string | undefined,
    key_evidence_used: t.key_evidence_used as string | string[] | undefined,
    policy_checks: t.policy_checks as string | string[] | undefined,
    uncertainties: t.uncertainties as string | string[] | undefined,
  };
}

describe("extractTraceSummary", () => {
  it("returns null for null input", () => {
    expect(extractTraceSummary(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractTraceSummary("string")).toBeNull();
    expect(extractTraceSummary(42)).toBeNull();
  });

  it("returns null when trace_summary is missing", () => {
    expect(extractTraceSummary({ other_field: "value" })).toBeNull();
  });

  it("returns null when trace_summary is not an object", () => {
    expect(extractTraceSummary({ trace_summary: "not an object" })).toBeNull();
    expect(extractTraceSummary({ trace_summary: 123 })).toBeNull();
  });

  it("extracts all fields from valid trace_summary", () => {
    const json = {
      trace_summary: {
        mission_detected: true,
        analysis_path: "depth-first",
        key_evidence_used: ["evidence1", "evidence2"],
        policy_checks: ["check1"],
        uncertainties: ["uncertainty1"],
      },
    };
    const result = extractTraceSummary(json);
    expect(result).not.toBeNull();
    expect(result!.mission_detected).toBe(true);
    expect(result!.analysis_path).toBe("depth-first");
    expect(result!.key_evidence_used).toEqual(["evidence1", "evidence2"]);
    expect(result!.policy_checks).toEqual(["check1"]);
    expect(result!.uncertainties).toEqual(["uncertainty1"]);
  });

  it("handles partial trace_summary with missing fields", () => {
    const json = {
      trace_summary: {
        mission_detected: false,
      },
    };
    const result = extractTraceSummary(json);
    expect(result).not.toBeNull();
    expect(result!.mission_detected).toBe(false);
    expect(result!.analysis_path).toBeUndefined();
    expect(result!.key_evidence_used).toBeUndefined();
  });

  it("handles string-type mission_detected", () => {
    const json = {
      trace_summary: {
        mission_detected: "yes",
      },
    };
    const result = extractTraceSummary(json);
    expect(result!.mission_detected).toBe("yes");
  });

  it("handles string-type key_evidence_used", () => {
    const json = {
      trace_summary: {
        key_evidence_used: "single evidence",
      },
    };
    const result = extractTraceSummary(json);
    expect(result!.key_evidence_used).toBe("single evidence");
  });
});
