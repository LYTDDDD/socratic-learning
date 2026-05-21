import { describe, expect, it } from "vitest";
import { isMultiAgentResponse, parseAgentSteps } from "../lib/agent-trace";

describe("agent-trace", () => {
  it("parses valid agent steps from raw trace json", () => {
    const raw = JSON.stringify({
      steps: [
        {
          agent: "supervisor",
          startedAt: "2026-01-01T00:00:00Z",
          finishedAt: "2026-01-01T00:00:01Z",
          input: {},
          output: { steps: ["review"] },
          status: "success",
          error: null,
        },
      ],
      supervisorDecision: "done",
    });

    expect(parseAgentSteps(raw)).toHaveLength(1);
  });

  it("treats prompt-version tagged results as multi-agent", () => {
    expect(
      isMultiAgentResponse({
        raw: "not json",
        runLog: {
          run_id: "run_multi_agent",
          created_at: "2026-05-20T00:00:00.000Z",
          input_snapshot: { originalGoal: "goal", conversation: "conversation" },
          prompt_version: "multi-agent:offline-mission-analysis-v0.3-json-only",
          model_name: "test-model",
          request_status: "success",
          parse_status: "failed",
          duration_ms: 100,
          error_message: null,
        },
      }),
    ).toBe(true);
  });

  it("falls back to parsed agent steps when runLog is missing", () => {
    expect(
      isMultiAgentResponse({
        raw: JSON.stringify({
          steps: [
            {
              agent: "review",
              startedAt: "2026-01-01T00:00:00Z",
              finishedAt: "2026-01-01T00:00:01Z",
              input: {},
              output: { summary: "ok" },
              status: "success",
              error: null,
            },
          ],
          supervisorDecision: "done",
        }),
        runLog: null,
      }),
    ).toBe(true);
  });
});
