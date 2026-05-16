import type { RunLog } from "./run-log";
import type { CognitiveAsset } from "./extract-asset";

export type AnalyzeInput = {
  background: string;
  originalGoal: string;
  conversation: string;
  notes: string;
  expectedOutput: string;
  preferenceRules?: string[];
  missionId?: string | null;
  existingAssets?: CognitiveAsset[];
};

export type ExtractJsonResult = {
  success: boolean;
  json?: object;
  markdown?: string;
  error?: string;
};

export type AnalyzeResponse = {
  markdown: string | null;
  json: unknown | null;
  raw: string | null;
  parseStatus: "success" | "partial" | "failed" | "not_attempted";
  error: string | null;
  runLog: RunLog | null;
};
