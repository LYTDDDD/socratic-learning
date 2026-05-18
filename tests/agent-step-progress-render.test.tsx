import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentStepProgress } from "../components/AgentStepProgress";
import type { AgentStep } from "../lib/agent-types";

function makeStep(overrides: Partial<AgentStep> & Pick<AgentStep, "agent" | "status">): AgentStep {
  return {
    startedAt: "2025-01-01T00:00:00.000Z",
    finishedAt: "2025-01-01T00:00:02.500Z",
    input: {},
    output: null,
    error: null,
    ...overrides,
  };
}

describe("AgentStepProgress", () => {
  it("renders nothing when steps is empty", () => {
    const { container } = render(<AgentStepProgress steps={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a success step with checkmark icon", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "review", status: "success" }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("复盘")).toBeInTheDocument();

    const checkmarkContainer = document.querySelector(".bg-green\\/15");
    expect(checkmarkContainer).toBeInTheDocument();
  });

  it("renders a failed step with X icon and error message", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "asset", status: "failed", error: "API 超时" }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("资产决策")).toBeInTheDocument();
    expect(screen.getByText("API 超时")).toBeInTheDocument();

    const xContainer = document.querySelector(".bg-amber\\/15");
    expect(xContainer).toBeInTheDocument();
  });

  it("renders a skipped step with dash icon and skip label", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "curator", status: "skipped" }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("整理建议")).toBeInTheDocument();
    expect(screen.getByText("(跳过)")).toBeInTheDocument();

    const skipContainer = document.querySelector(".bg-surface-2");
    expect(skipContainer).toBeInTheDocument();
  });

  it("renders a running step with spinning icon", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "depth_evaluation", status: "running", finishedAt: null }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("深度评估")).toBeInTheDocument();
    expect(screen.getByText("执行中…")).toBeInTheDocument();

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("displays duration for completed steps", () => {
    const steps: AgentStep[] = [
      makeStep({
        agent: "review",
        status: "success",
        startedAt: "2025-01-01T00:00:00.000Z",
        finishedAt: "2025-01-01T00:00:02.500Z",
      }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("2.5s")).toBeInTheDocument();
  });

  it("does not display duration when finishedAt is null", () => {
    const steps: AgentStep[] = [
      makeStep({
        agent: "review",
        status: "success",
        finishedAt: null,
      }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.queryByText(/s$/)).not.toBeInTheDocument();
  });

  it("renders multiple steps in order", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "supervisor", status: "success" }),
      makeStep({ agent: "review", status: "success" }),
      makeStep({ agent: "depth_evaluation", status: "running", finishedAt: null }),
    ];
    render(<AgentStepProgress steps={steps} />);

    const names = screen.getAllByText(/编排器|复盘|深度评估/);
    expect(names[0]).toHaveTextContent("编排器");
    expect(names[1]).toHaveTextContent("复盘");
    expect(names[2]).toHaveTextContent("深度评估");
  });

  it("renders the header title", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "review", status: "success" }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("流水线进度")).toBeInTheDocument();
  });

  it("renders failed step without error when error is null", () => {
    const steps: AgentStep[] = [
      makeStep({ agent: "asset", status: "failed", error: null }),
    ];
    render(<AgentStepProgress steps={steps} />);

    expect(screen.getByText("资产决策")).toBeInTheDocument();

    const errorDiv = document.querySelector(".bg-amber\\/5");
    expect(errorDiv).not.toBeInTheDocument();
  });
});
