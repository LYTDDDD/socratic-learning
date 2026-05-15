export type RunLog = {
  run_id: string;
  created_at: string;
  input_snapshot: { originalGoal: string; conversation: string };
  prompt_version: string;
  model_name: string;
  request_status: "success" | "partial" | "failed" | "error";
  parse_status: "success" | "partial" | "failed" | "not_attempted";
  duration_ms: number;
  error_message: string | null;
};

export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
