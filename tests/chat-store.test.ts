import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import {
  loadChatSessions,
  createChatSession,
  deleteChatSession,
  addMessageToSession,
  getSessionById,
  getSessionsForMission,
  saveChatSession,
  markReviewTriggered,
} from "../lib/chat-store";

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

describe("loadChatSessions", () => {
  it("returns empty array when no sessions stored", () => {
    expect(loadChatSessions()).toEqual([]);
  });
});

describe("createChatSession", () => {
  it("creates a session with generated id and timestamps", () => {
    const session = createChatSession("Test Chat", null);
    expect(session).not.toBeNull();
    expect(session!.id).toMatch(/^chat_/);
    expect(session!.title).toBe("Test Chat");
    expect(session!.missionId).toBeNull();
    expect(session!.messages).toEqual([]);
    expect(session!.createdAt).toBeTruthy();
  });

  it("uses default title when empty string provided", () => {
    const session = createChatSession("", "mission_123");
    expect(session!.title).toBe("新对话");
    expect(session!.missionId).toBe("mission_123");
  });

  it("persists to localStorage", () => {
    createChatSession("Persist Test", null);
    expect(loadChatSessions()).toHaveLength(1);
    expect(loadChatSessions()[0].title).toBe("Persist Test");
  });
});

describe("addMessageToSession", () => {
  it("adds a message to an existing session", () => {
    const session = createChatSession("Chat", null);
    const msg = addMessageToSession(session!.id, { role: "user", content: "Hello" });
    expect(msg).not.toBeNull();
    expect(msg!.role).toBe("user");
    expect(msg!.content).toBe("Hello");
    expect(msg!.id).toMatch(/^chat_/);
    expect(msg!.createdAt).toBeTruthy();
  });

  it("updates session updatedAt", () => {
    const session = createChatSession("Chat", null);
    const before = session!.updatedAt;
    addMessageToSession(session!.id, { role: "user", content: "Hi" });
    const updated = getSessionById(session!.id);
    expect(updated!.updatedAt).toBeTruthy();
  });

  it("returns null for non-existent session", () => {
    const msg = addMessageToSession("nonexistent", { role: "user", content: "Hi" });
    expect(msg).toBeNull();
  });
});

describe("deleteChatSession", () => {
  it("removes a session by id", () => {
    const session = createChatSession("To Delete", null);
    expect(loadChatSessions()).toHaveLength(1);
    deleteChatSession(session!.id);
    expect(loadChatSessions()).toHaveLength(0);
  });
});

describe("getSessionById", () => {
  it("returns the session with given id", () => {
    const session = createChatSession("Find Me", null);
    const found = getSessionById(session!.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Find Me");
  });

  it("returns null for non-existent id", () => {
    expect(getSessionById("nonexistent")).toBeNull();
  });
});

describe("getSessionsForMission", () => {
  it("filters sessions by missionId", () => {
    createChatSession("A", "mission_1");
    createChatSession("B", "mission_2");
    createChatSession("C", null);
    expect(getSessionsForMission("mission_1")).toHaveLength(1);
    expect(getSessionsForMission("mission_1")[0].title).toBe("A");
    expect(getSessionsForMission("mission_2")).toHaveLength(1);
    expect(getSessionsForMission("nonexistent")).toHaveLength(0);
  });
});

describe("saveChatSession", () => {
  it("updates an existing session", () => {
    const session = createChatSession("Original", null);
    const modified = { ...session!, title: "Updated" };
    saveChatSession(modified);
    expect(getSessionById(session!.id)!.title).toBe("Updated");
  });

  it("adds a new session if id not found", () => {
    const newSession = {
      id: "chat_manual_1",
      title: "Manual",
      missionId: null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveChatSession(newSession);
    expect(loadChatSessions()).toHaveLength(1);
    expect(getSessionById("chat_manual_1")).not.toBeNull();
  });
});

describe("markReviewTriggered", () => {
  it("marks user messages as reviewTriggered", () => {
    const session = createChatSession("Review Test", null);
    addMessageToSession(session!.id, { role: "user", content: "Let's review" });
    addMessageToSession(session!.id, { role: "assistant", content: "Sure" });
    markReviewTriggered(session!.id);
    const updated = getSessionById(session!.id);
    const userMsg = updated!.messages.find((m) => m.role === "user");
    expect(userMsg!.reviewTriggered).toBe(true);
  });

  it("does not affect non-existent session", () => {
    expect(() => markReviewTriggered("nonexistent")).not.toThrow();
  });
});
