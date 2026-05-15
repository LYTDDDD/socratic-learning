export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  reviewTriggered?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  missionId: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "socratic-chat-sessions";

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChatSession => {
      if (!item || typeof item !== "object") return false;
      const s = item as Partial<ChatSession>;
      return (
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        Array.isArray(s.messages) &&
        typeof s.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

export function createChatSession(
  title: string,
  missionId: string | null
): ChatSession | null {
  try {
    const now = new Date().toISOString();
    const entry: ChatSession = {
      id: generateId(),
      title: title || "新对话",
      missionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const all = loadChatSessions();
    all.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return entry;
  } catch {
    return null;
  }
}

export function deleteChatSession(id: string): void {
  try {
    const all = loadChatSessions();
    const filtered = all.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function addMessageToSession(
  sessionId: string,
  message: Omit<ChatMessage, "id" | "createdAt">
): ChatMessage | null {
  try {
    const all = loadChatSessions();
    const idx = all.findIndex((s) => s.id === sessionId);
    if (idx < 0) return null;
    const msg: ChatMessage = {
      ...message,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    all[idx].messages.push(msg);
    all[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return msg;
  } catch {
    return null;
  }
}

export function getSessionById(id: string): ChatSession | null {
  const all = loadChatSessions();
  return all.find((s) => s.id === id) ?? null;
}

export function getSessionsForMission(missionId: string): ChatSession[] {
  return loadChatSessions().filter((s) => s.missionId === missionId);
}

export function saveChatSession(session: ChatSession): void {
  try {
    const all = loadChatSessions();
    const idx = all.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      all[idx] = session;
    } else {
      all.unshift(session);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function markReviewTriggered(sessionId: string): void {
  try {
    const all = loadChatSessions();
    const idx = all.findIndex((s) => s.id === sessionId);
    if (idx < 0) return;
    all[idx].messages = all[idx].messages.map((m) =>
      m.role === "user" && m.reviewTriggered !== true
        ? { ...m, reviewTriggered: true }
        : m
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
