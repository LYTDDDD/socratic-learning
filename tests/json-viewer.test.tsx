import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonViewer } from "../components/JsonViewer";

describe("JsonViewer", () => {
  it("labels failed-parse raw content as model original output", () => {
    render(<JsonViewer json={null} parseStatus="failed" raw="raw model text" />);

    const toggle = screen.getByRole("button", { name: "查看模型原始输出" });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "隐藏模型原始输出" })).toBeInTheDocument();
    expect(screen.getByText("raw model text")).toBeInTheDocument();
  });

  it("labels failed-parse raw content as agent execution trace when provided", () => {
    render(<JsonViewer json={null} parseStatus="failed" raw="raw agent trace" rawLabel="Agent 执行轨迹" />);

    const toggle = screen.getByRole("button", { name: "查看Agent 执行轨迹" });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "隐藏Agent 执行轨迹" })).toBeInTheDocument();
    expect(screen.getByText("raw agent trace")).toBeInTheDocument();
  });
});
