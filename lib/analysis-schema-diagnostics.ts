type DiagnosticLevel = "complete" | "partial" | "failed";

type DiagnosticResult = {
  level: DiagnosticLevel;
  missingPaths: string[];
  presentPaths: string[];
};

const CRITICAL_PATHS = [
  "mission_review",
  "mission_review.original_goal",
  "mission_review.key_turning_points",
  "mission_review.final_judgment",
  "depth_evaluation",
  "depth_evaluation.overall_depth_score",
  "depth_evaluation.dimension_scores",
  "asset_decision",
  "asset_decision.asset_candidate",
  "trace_summary",
  "trace_summary.mission_detected",
] as const;

function hasPath(obj: unknown, path: string): boolean {
  if (obj == null || typeof obj !== "object") return false;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return false;
    if (!(part in current)) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

export function diagnoseAnalysisJson(json: unknown): DiagnosticResult {
  if (json == null || typeof json !== "object") {
    return { level: "failed", missingPaths: [...CRITICAL_PATHS], presentPaths: [] };
  }

  const missingPaths: string[] = [];
  const presentPaths: string[] = [];

  for (const path of CRITICAL_PATHS) {
    if (hasPath(json, path)) {
      presentPaths.push(path);
    } else {
      missingPaths.push(path);
    }
  }

  const level: DiagnosticLevel =
    missingPaths.length === 0 ? "complete" : presentPaths.length === 0 ? "failed" : "partial";

  return { level, missingPaths, presentPaths };
}

export function diagnosticLabel(level: DiagnosticLevel): string {
  if (level === "complete") return "完整";
  if (level === "partial") return "部分字段缺失";
  return "解析失败";
}

export function diagnosticTone(level: DiagnosticLevel): string {
  if (level === "complete") return "bg-moss/15 text-moss";
  if (level === "partial") return "bg-amber/15 text-amber";
  return "bg-red/15 text-red";
}

export type { DiagnosticLevel, DiagnosticResult };
