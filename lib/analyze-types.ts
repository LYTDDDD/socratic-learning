import type { RunLog } from "./run-log";

export type AnalyzeInput = {
  background: string;
  originalGoal: string;
  conversation: string;
  notes: string;
  expectedOutput: string;
  preferenceRules?: string[];
  missionId?: string | null;
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
  parseStatus: "success" | "failed" | "not_attempted";
  error: string | null;
  runLog: RunLog | null;
};
