import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StructuredReportView } from "../components/StructuredReportView";
import fixtureWithNewAsset from "./fixtures/report-with-new-asset.json";
import fixtureWithUpdateProposal from "./fixtures/report-with-update-proposal.json";
import fixtureNoAsset from "./fixtures/report-no-asset.json";
import fixturePartial from "./fixtures/report-partial.json";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  get length(): number { return Object.keys(this.store).length; }
  key(index: number): string | null { const keys = Object.keys(this.store); return keys[index] ?? null; }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

beforeEach(() => {
  mockLocalStorage.clear();
});

describe("StructuredReportView regression fixtures", () => {
  it("renders report with new asset candidate", () => {
    render(<StructuredReportView json={fixtureWithNewAsset} parseStatus="success" />);

    expect(screen.getByText("任务复盘")).toBeInTheDocument();
    expect(screen.getByText("理解斜率概念")).toBeInTheDocument();
    expect(screen.getAllByText("7/10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("资产决策")).toBeInTheDocument();
  });

  it("renders report with update proposals from asset_decision.update_proposals only", () => {
    render(<StructuredReportView json={fixtureWithUpdateProposal} parseStatus="success" />);

    expect(screen.getByText("资产更新建议")).toBeInTheDocument();
    expect(screen.getByText("核心洞察需要从直觉描述升级为形式化定义")).toBeInTheDocument();
    expect(screen.getByText("迁移价值维度需要独立版本记录")).toBeInTheDocument();
    expect(screen.getAllByText("建议改动").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("斜率→速度→加速度：变化率概念链")).toBeInTheDocument();
  });

  it("renders report with no asset", () => {
    render(<StructuredReportView json={fixtureNoAsset} parseStatus="success" />);

    expect(screen.getByText("理解函数概念")).toBeInTheDocument();
    expect(screen.getAllByText("5/10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("资产决策")).toBeInTheDocument();
  });

  it("renders partial report with missing fields", () => {
    render(<StructuredReportView json={fixturePartial} parseStatus="success" />);

    expect(screen.getByText("理解极限概念")).toBeInTheDocument();
    expect(screen.getAllByText("5/10").length).toBeGreaterThanOrEqual(1);
  });
});
