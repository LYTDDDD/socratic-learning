import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import {
  loadMissions,
  saveMission,
  updateMission,
  archiveMission,
  deleteMission,
  getMissionById,
  getReportsForMission,
  assignReportToMission,
  unassignReportFromMission,
  getMissionForReport,
  getAssetsForMission,
} from "../lib/mission-store";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  get length(): number { return Object.keys(this.store).length; }
  key(index: number): string | null { return Object.keys(this.store)[index] ?? null; }
}

const mockLocalStorage = new LocalStorageMock();

beforeAll(() => {
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

beforeEach(() => {
  localStorage.clear();
});

describe("loadMissions", () => {
  it("returns empty array when no missions stored", () => {
    expect(loadMissions()).toEqual([]);
  });

  it("filters by status", () => {
    saveMission({ title: "Mission A", description: "", status: "active" });
    saveMission({ title: "Mission B", description: "", status: "archived" });
    expect(loadMissions("active")).toHaveLength(1);
    expect(loadMissions("active")[0].title).toBe("Mission A");
    expect(loadMissions("archived")).toHaveLength(1);
    expect(loadMissions("reviewed")).toHaveLength(0);
  });
});

describe("saveMission", () => {
  it("generates id and timestamps", () => {
    const mission = saveMission({ title: "Test Mission", description: "desc", status: "active" });
    expect(mission).not.toBeNull();
    expect(mission!.id).toMatch(/^mission_/);
    expect(mission!.createdAt).toBeTruthy();
    expect(mission!.updatedAt).toBeTruthy();
    expect(mission!.archivedAt).toBeNull();
  });

  it("persists to localStorage", () => {
    saveMission({ title: "Persist Test", description: "test desc", status: "active" });
    const loaded = loadMissions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe("Persist Test");
    expect(loaded[0].description).toBe("test desc");
  });
});

describe("updateMission", () => {
  it("updates title and description", () => {
    const mission = saveMission({ title: "Original", description: "", status: "active" });
    const updated = updateMission(mission!.id, { title: "Updated", description: "new desc" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Updated");
    expect(updated!.description).toBe("new desc");
    expect(updated!.updatedAt).toBeTruthy();
  });

  it("updates status", () => {
    const mission = saveMission({ title: "Test", description: "", status: "active" });
    const updated = updateMission(mission!.id, { status: "reviewed" });
    expect(updated!.status).toBe("reviewed");
  });

  it("returns null for non-existent id", () => {
    expect(updateMission("nonexistent", { title: "x" })).toBeNull();
  });
});

describe("archiveMission", () => {
  it("sets status to archived and archivedAt", () => {
    const mission = saveMission({ title: "To Archive", description: "", status: "active" });
    const archived = archiveMission(mission!.id);
    expect(archived).not.toBeNull();
    expect(archived!.status).toBe("archived");
    expect(archived!.archivedAt).toBeTruthy();
  });
});

describe("deleteMission", () => {
  it("removes a mission by id", () => {
    const mission = saveMission({ title: "To Delete", description: "", status: "active" });
    expect(loadMissions()).toHaveLength(1);
    deleteMission(mission!.id);
    expect(loadMissions()).toHaveLength(0);
  });

  it("cleans up associated report links", () => {
    const mission = saveMission({ title: "With Reports", description: "", status: "active" });
    assignReportToMission(mission!.id, "run_001");
    assignReportToMission(mission!.id, "run_002");
    expect(getReportsForMission(mission!.id)).toHaveLength(2);
    deleteMission(mission!.id);
    expect(getReportsForMission(mission!.id)).toHaveLength(0);
    expect(getMissionForReport("run_001")).toBeNull();
    expect(getMissionForReport("run_002")).toBeNull();
  });
});

describe("getMissionById", () => {
  it("returns the mission with given id", () => {
    const mission = saveMission({ title: "Find Me", description: "", status: "active" });
    const found = getMissionById(mission!.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Find Me");
  });

  it("returns null for non-existent id", () => {
    expect(getMissionById("nonexistent")).toBeNull();
  });
});

describe("assignReportToMission", () => {
  it("creates a link between mission and report", () => {
    const mission = saveMission({ title: "Test", description: "", status: "active" });
    assignReportToMission(mission!.id, "run_001");
    const reports = getReportsForMission(mission!.id);
    expect(reports).toHaveLength(1);
    expect(reports[0].run_id).toBe("run_001");
  });

  it("does not create duplicate links", () => {
    const mission = saveMission({ title: "Test", description: "", status: "active" });
    assignReportToMission(mission!.id, "run_001");
    assignReportToMission(mission!.id, "run_001");
    expect(getReportsForMission(mission!.id)).toHaveLength(1);
  });
});

describe("unassignReportFromMission", () => {
  it("removes a link between mission and report", () => {
    const mission = saveMission({ title: "Test", description: "", status: "active" });
    assignReportToMission(mission!.id, "run_001");
    unassignReportFromMission(mission!.id, "run_001");
    expect(getReportsForMission(mission!.id)).toHaveLength(0);
  });
});

describe("getMissionForReport", () => {
  it("returns the mission linked to a report", () => {
    const mission = saveMission({ title: "Linked Mission", description: "", status: "active" });
    assignReportToMission(mission!.id, "run_001");
    const found = getMissionForReport("run_001");
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Linked Mission");
  });

  it("returns null when no mission linked", () => {
    expect(getMissionForReport("run_nonexistent")).toBeNull();
  });
});

describe("getAssetsForMission", () => {
  it("filters assets by source_mission", () => {
    const mission = saveMission({ title: "Asset Mission", description: "", status: "active" });
    const assets = [
      { source_mission: mission!.id },
      { source_mission: "other_mission" },
      { source_mission: mission!.id },
      { source_mission: "" },
    ];
    const filtered = getAssetsForMission(mission!.id, assets);
    expect(filtered).toHaveLength(2);
  });
});
