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
});
