"use client";

import { type AgentStep, type AgentType, AGENT_NAME_MAP } from "../lib/agent-types";

function formatDuration(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const seconds = (end - start) / 1000;
  return `${seconds.toFixed(1)}s`;
}

function StatusIcon({ status }: { status: AgentStep["status"] }) {
  switch (status) {
    case "success":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-moss/15 text-moss">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case "failed":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rust/15 text-rust">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case "running":
      return (
        <span className="flex h-5 w-5 items-center justify-center">
          <svg className="h-4 w-4 animate-spin text-ink/60" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      );
    case "skipped":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/10 text-ink/30">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
  }
}

export type AgentProgressStep = {
  agent: AgentType;
  status: "running" | "success" | "failed" | "skipped";
  durationMs?: number;
  error?: string;
};

export function AgentStepProgress({ steps, progressSteps }: { steps: AgentStep[]; progressSteps?: AgentProgressStep[] }) {
  const displaySteps = progressSteps && progressSteps.length > 0
    ? progressSteps.map((ps) => ({
        agent: ps.agent,
        startedAt: "",
        finishedAt: ps.status === "success" || ps.status === "failed" ? new Date().toISOString() : null,
        input: {},
        output: null,
        status: ps.status,
        error: ps.error ?? null,
        durationMs: ps.durationMs,
      }))
    : steps;

  if (displaySteps.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-paper/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">流水线进度</h3>
      <div className="space-y-0">
        {displaySteps.map((step, i) => {
          const isLast = i === displaySteps.length - 1;
          const duration = "durationMs" in step && typeof step.durationMs === "number"
            ? `${(step.durationMs / 1000).toFixed(1)}s`
            : formatDuration(step.startedAt, step.finishedAt);

          return (
            <div key={`${step.agent}-${i}`}>
              <div className="flex items-center gap-2.5">
                <StatusIcon status={step.status} />
                <span className={`text-sm font-medium ${
                  step.status === "skipped" ? "text-ink/30" :
                  step.status === "running" ? "text-ink/70" :
                  "text-ink"
                }`}>
                  {AGENT_NAME_MAP[step.agent]}
                </span>
                {step.status === "skipped" ? (
                  <span className="text-xs text-ink/30">(跳过)</span>
                ) : duration ? (
                  <span className="text-xs text-ink/40">{duration}</span>
                ) : step.status === "running" ? (
                  <span className="text-xs text-ink/50">执行中…</span>
                ) : null}
              </div>

              {step.status === "failed" && step.error && (
                <div className="ml-7 mt-1 rounded border border-rust/20 bg-rust/5 px-2.5 py-1.5 text-xs text-rust">
                  {step.error}
                </div>
              )}

              {!isLast && (
                <div className="ml-2.5 flex h-5 items-center">
                  <div className="h-full w-px bg-line" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VALID_AGENT_TYPES: AgentType[] = ["supervisor", "review", "depth_evaluation", "asset", "curator", "reflection"];
const VALID_STATUSES = ["running", "success", "failed", "skipped"];

function isValidStep(item: unknown): item is AgentStep {
  if (typeof item !== "object" || item === null) return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.agent === "string" &&
    VALID_AGENT_TYPES.includes(s.agent as AgentType) &&
    typeof s.status === "string" &&
    VALID_STATUSES.includes(s.status) &&
    typeof s.startedAt === "string"
  );
}

export function parseAgentSteps(raw: string | null | undefined): AgentStep[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.steps || !Array.isArray(parsed.steps)) return [];
    return parsed.steps.filter(isValidStep);
  } catch {
    return [];
  }
}
