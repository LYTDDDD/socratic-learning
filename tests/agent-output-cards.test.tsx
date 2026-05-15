import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentOutputCards } from "../components/AgentOutputCards";
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

describe("AgentOutputCards", () => {
  describe("empty output handling", () => {
    it("renders empty state when steps is empty", () => {
      render(<AgentOutputCards steps={[]} />);
      expect(screen.getByText("暂无 Agent 输出")).toBeInTheDocument();
    });

    it("renders empty state when no steps have success status", () => {
      const steps: AgentStep[] = [
        makeStep({ agent: "review", status: "failed", error: "出错了" }),
        makeStep({ agent: "curator", status: "skipped" }),
      ];
      render(<AgentOutputCards steps={steps} />);
      expect(screen.getByText("暂无 Agent 输出")).toBeInTheDocument();
    });

    it("renders empty state when success steps have no output", () => {
      const steps: AgentStep[] = [
        makeStep({ agent: "review", status: "success", output: null }),
      ];
      render(<AgentOutputCards steps={steps} />);
      expect(screen.getByText("暂无 Agent 输出")).toBeInTheDocument();
    });
  });

  describe("agent type output cards", () => {
    it("renders supervisor output with reasoning and steps", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: {
            reasoning: "先复盘再评估",
            steps: ["review", "depth_evaluation"],
          },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("编排决策")).toBeInTheDocument();
      expect(screen.getByText("先复盘再评估")).toBeInTheDocument();
      expect(screen.getByText("复盘")).toBeInTheDocument();
      expect(screen.getByText("深度评估")).toBeInTheDocument();
    });

    it("renders review output with summary and key decisions", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "review",
          status: "success",
          output: {
            summary: "本次复盘总结",
            key_decisions: ["决策一", "决策二"],
            turning_points: ["转折点A"],
            key_takeaways: ["收获B"],
          },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("总结")).toBeInTheDocument();
      expect(screen.getByText("本次复盘总结")).toBeInTheDocument();
      expect(screen.getByText("关键决策")).toBeInTheDocument();
      expect(screen.getByText("决策一")).toBeInTheDocument();
      expect(screen.getByText("转折点")).toBeInTheDocument();
      expect(screen.getByText("转折点A")).toBeInTheDocument();
      expect(screen.getByText("核心收获")).toBeInTheDocument();
      expect(screen.getByText("收获B")).toBeInTheDocument();
    });

    it("renders depth_evaluation output with score and blind spots", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: {
            depth_score: 6,
            blind_spots: ["盲点1"],
            improvement_directions: ["方向A"],
            reasoning: "评分理由",
          },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("深度评分")).toBeInTheDocument();
      expect(screen.getByText("6/10")).toBeInTheDocument();
      expect(screen.getByText("盲点")).toBeInTheDocument();
      expect(screen.getByText("盲点1")).toBeInTheDocument();
      expect(screen.getByText("改进方向")).toBeInTheDocument();
      expect(screen.getByText("方向A")).toBeInTheDocument();
      expect(screen.getByText("评估理由")).toBeInTheDocument();
      expect(screen.getByText("评分理由")).toBeInTheDocument();
    });

    it("renders asset output with has_asset true", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "asset",
          status: "success",
          output: {
            has_asset: true,
            asset_type: "ConceptCard",
            title: "测试资产",
            core_insight: "核心洞察内容",
            transferable_value: "可迁移到其他场景",
          },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("值得提取")).toBeInTheDocument();
      expect(screen.getByText("资产类型")).toBeInTheDocument();
      expect(screen.getByText("ConceptCard")).toBeInTheDocument();
      expect(screen.getByText("标题")).toBeInTheDocument();
      expect(screen.getByText("测试资产")).toBeInTheDocument();
      expect(screen.getByText("核心洞察")).toBeInTheDocument();
      expect(screen.getByText("核心洞察内容")).toBeInTheDocument();
      expect(screen.getByText("可迁移价值")).toBeInTheDocument();
      expect(screen.getByText("可迁移到其他场景")).toBeInTheDocument();
    });

    it("renders asset output with has_asset false", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "asset",
          status: "success",
          output: { has_asset: false },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("不建议提取")).toBeInTheDocument();
    });

    it("renders curator output with connections and tags", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "curator",
          status: "success",
          output: {
            connections: [
              { source_concept: "概念A", target_concept: "概念B", connection_type: "因果" },
            ],
            organization_tips: ["建议一"],
            suggested_tags: ["标签1", "标签2"],
          },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("关联建议")).toBeInTheDocument();
      expect(screen.getByText("概念A")).toBeInTheDocument();
      expect(screen.getByText("概念B")).toBeInTheDocument();
      expect(screen.getByText("因果")).toBeInTheDocument();
      expect(screen.getAllByText("整理建议").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("建议一")).toBeInTheDocument();
      expect(screen.getByText("建议标签")).toBeInTheDocument();
      expect(screen.getByText("标签1")).toBeInTheDocument();
      expect(screen.getByText("标签2")).toBeInTheDocument();
    });

    it("renders reflection output with questions and action items", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "reflection",
          status: "success",
          output: {
            reflection_questions: ["问题1"],
            action_items: ["行动1"],
            mindset_shifts: ["转变1"],
          },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("反思问题")).toBeInTheDocument();
      expect(screen.getByText("问题1")).toBeInTheDocument();
      expect(screen.getByText("行动建议")).toBeInTheDocument();
      expect(screen.getByText("行动1")).toBeInTheDocument();
      expect(screen.getByText("思维转变")).toBeInTheDocument();
      expect(screen.getByText("转变1")).toBeInTheDocument();
    });
  });

  describe("depth score progress bar color", () => {
    it("uses red for score <= 3", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: 2 },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const bar = document.querySelector(".bg-rust");
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveStyle({ width: "20%" });
    });

    it("uses orange for score 4-5", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: 5 },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const bar = document.querySelector(".bg-amber-500");
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveStyle({ width: "50%" });
    });

    it("uses yellow for score 6-7", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: 7 },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const bar = document.querySelector(".bg-amber-400");
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveStyle({ width: "70%" });
    });

    it("uses green for score >= 8", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: 9 },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const bar = document.querySelector(".bg-moss");
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveStyle({ width: "90%" });
    });
  });

  describe("collapse / expand", () => {
    it("first card is expanded by default, others are collapsed", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "第一" },
        }),
        makeStep({
          agent: "review",
          status: "success",
          output: { summary: "第二" },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("编排决策")).toBeInTheDocument();
      expect(screen.getByText("第一")).toBeInTheDocument();

      expect(screen.queryByText("总结")).not.toBeInTheDocument();
      expect(screen.queryByText("第二")).not.toBeInTheDocument();
    });

    it("expands a collapsed card on click", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "第一" },
        }),
        makeStep({
          agent: "review",
          status: "success",
          output: { summary: "第二" },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const reviewButtons = screen.getAllByRole("button");
      const reviewButton = reviewButtons[1];
      fireEvent.click(reviewButton);

      expect(screen.getByText("总结")).toBeInTheDocument();
      expect(screen.getByText("第二")).toBeInTheDocument();
    });

    it("collapses an expanded card on click", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "内容" },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("编排决策")).toBeInTheDocument();

      const button = screen.getAllByRole("button")[0];
      fireEvent.click(button);

      expect(screen.queryByText("编排决策")).not.toBeInTheDocument();
    });
  });

  describe("failed step output in card", () => {
    it("does not render failed steps as cards", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "review",
          status: "failed",
          error: "网络超时",
          finishedAt: "2025-01-01T00:00:05.000Z",
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("暂无 Agent 输出")).toBeInTheDocument();
      expect(screen.queryByText("网络超时")).not.toBeInTheDocument();
    });

    it("renders only success steps, not failed ones", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "成功推理" },
        }),
        makeStep({
          agent: "review",
          status: "failed",
          error: "网络超时",
          finishedAt: "2025-01-01T00:00:05.000Z",
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("编排决策")).toBeInTheDocument();
      expect(screen.getByText("成功推理")).toBeInTheDocument();
      expect(screen.queryByText("复盘")).not.toBeInTheDocument();
      expect(screen.queryByText("网络超时")).not.toBeInTheDocument();
    });
  });

  describe("status badge and duration", () => {
    it("shows status badge for each card", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "test" },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("成功")).toBeInTheDocument();
    });

    it("shows duration for completed steps", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "test" },
          startedAt: "2025-01-01T00:00:00.000Z",
          finishedAt: "2025-01-01T00:00:02.500Z",
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("2.5s")).toBeInTheDocument();
    });

    it("shows dash for steps without finishedAt", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "test" },
          finishedAt: null,
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("shows dash for invalid date strings (NaN)", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "test" },
          startedAt: "invalid-date",
          finishedAt: "also-invalid",
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("shows dash for negative duration", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "supervisor",
          status: "success",
          output: { reasoning: "test" },
          startedAt: "2025-01-01T00:00:05.000Z",
          finishedAt: "2025-01-01T00:00:01.000Z",
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("depth score edge cases", () => {
    it("does not render score bar when depth_score is not a number", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: "high", blind_spots: [], improvement_directions: [] },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
    });

    it("clamps depth_score below 0 to 0", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: -5, blind_spots: [], improvement_directions: [] },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const bar = document.querySelector("[style*='width']");
      expect(bar).toHaveStyle({ width: "0%" });
    });

    it("clamps depth_score above 10 to 100%", () => {
      const steps: AgentStep[] = [
        makeStep({
          agent: "depth_evaluation",
          status: "success",
          output: { depth_score: 15, blind_spots: [], improvement_directions: [] },
        }),
      ];
      render(<AgentOutputCards steps={steps} />);

      const bar = document.querySelector("[style*='width']");
      expect(bar).toHaveStyle({ width: "100%" });
    });
  });
});
