"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatSession, ChatMessage } from "../lib/chat-store";
import {
  loadChatSessions,
  createChatSession,
  deleteChatSession,
  addMessageToSession,
} from "../lib/chat-store";
import { getMissionById } from "../lib/mission-store";
import { Send, MessageSquarePlus, Trash2, Sparkles, Zap } from "lucide-react";

type ChatWorkspaceProps = {
  currentMissionId: string | null;
  onReviewTriggered?: (sessionId: string, missionId: string | null) => void;
};

export function ChatWorkspace({ currentMissionId, onReviewTriggered }: ChatWorkspaceProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessions(loadChatSessions());
  }, []);

  function reloadSessions() {
    setSessions(loadChatSessions());
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const hasReviewTriggered = activeSession?.messages.some(
    (m) => m.reviewTriggered === true
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length]);

  function handleCreateSession() {
    const session = createChatSession("新对话", currentMissionId);
    if (session) {
      reloadSessions();
      setActiveSessionId(session.id);
    }
  }

  function handleDeleteSession(id: string) {
    deleteChatSession(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    reloadSessions();
  }

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeSessionId || isLoading) return;

    const userContent = inputText.trim();
    setInputText("");
    setIsLoading(true);

    addMessageToSession(activeSessionId, {
      role: "user",
      content: userContent,
    });
    reloadSessions();

    try {
      const currentSession = loadChatSessions().find((s) => s.id === activeSessionId);
      const allMessages = (currentSession?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const history = allMessages.slice(0, -1);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          history,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const assistantContent: string = data.reply ?? data.content ?? data.message ?? "";
      const reviewTriggered: boolean = data.reviewTriggered === true;

      addMessageToSession(activeSessionId, {
        role: "assistant",
        content: assistantContent,
        reviewTriggered,
      });
      reloadSessions();

      if (reviewTriggered && onReviewTriggered) {
        const activeSession = sessions.find((s) => s.id === activeSessionId);
        onReviewTriggered(activeSessionId, activeSession?.missionId ?? null);
      }
    } catch (err) {
      addMessageToSession(activeSessionId, {
        role: "assistant",
        content: `请求失败：${err instanceof Error ? err.message : "未知错误"}`,
      });
      reloadSessions();
    } finally {
      setIsLoading(false);
    }
  }, [inputText, activeSessionId, isLoading, currentMissionId, onReviewTriggered]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="grid h-full gap-0 rounded-xl shadow-sm xl:grid-cols-[260px_1fr]">
      <aside className="flex flex-col bg-surface-2">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-heading text-sm font-semibold text-ink">对话列表</h3>
          <button
            className="flex items-center gap-1.5 rounded-xl border border-moss/30 px-3 py-1.5 text-xs font-medium text-moss transition hover:bg-moss/10"
            onClick={handleCreateSession}
            type="button"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            新建
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {sessions.length === 0 && (
            <p className="px-5 py-5 text-xs text-ink/40">暂无对话，点击"新建"开始。</p>
          )}
          {sessions.map((session) => {
            const lastMsg = session.messages[session.messages.length - 1];
            const mission = session.missionId ? getMissionById(session.missionId) : null;
            return (
              <div
                key={session.id}
                className={`group cursor-pointer border-b border-line px-5 py-3 transition ${
                  activeSessionId === session.id
                    ? "bg-moss/10 border-l-2 border-l-moss"
                    : "hover:bg-surface-1"
                }`}
                onClick={() => setActiveSessionId(session.id)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-xs font-medium text-ink">
                    {session.title}
                  </span>
                  <button
                    className="shrink-0 rounded-lg p-1 text-rust/60 opacity-0 transition hover:bg-rust/10 hover:text-rust group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {mission && (
                  <span className="mt-1.5 inline-block rounded-lg bg-moss/10 px-2 py-0.5 text-[10px] text-moss">
                    {mission.title}
                  </span>
                )}
                {lastMsg && (
                  <p className="mt-1.5 truncate text-[11px] text-ink/40">
                    {lastMsg.content.slice(0, 50)}
                    {lastMsg.content.length > 50 ? "..." : ""}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-ink/30">
                  {new Date(session.updatedAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col bg-surface-1 rounded-r-xl">
        {activeSession ? (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
              <h3 className="font-heading text-sm font-semibold text-ink">{activeSession.title}</h3>
              {activeSession.missionId && (() => {
                const m = getMissionById(activeSession.missionId);
                return m ? (
                  <span className="inline-block rounded-lg bg-moss/10 px-2.5 py-1 text-[11px] font-medium text-moss">
                    Mission: {m.title}
                  </span>
                ) : null;
              })()}
            </header>

            {hasReviewTriggered && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
                <Zap className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">复盘已触发，点击此处生成 Mission Review</span>
                <button
                  className="rounded-xl bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-700"
                  onClick={() => {
                    if (onReviewTriggered) {
                      onReviewTriggered(activeSession.id, activeSession.missionId);
                    }
                  }}
                  type="button"
                >
                  生成 Review
                </button>
              </div>
            )}

            <div className="flex-1 overflow-auto px-5 py-5">
              {activeSession.messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-moss/10">
                    <Sparkles className="h-7 w-7 text-moss" />
                  </div>
                  <p className="text-sm text-ink/40">开始对话吧</p>
                </div>
              )}
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="mb-4 flex items-start gap-2">
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <span className="text-xs text-ink/50">正在思考…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-line px-5 py-4">
              <div className="flex items-end gap-3">
                <textarea
                  className="flex-1 resize-none rounded-xl border border-line bg-surface-0 px-4 py-3 text-sm text-ink outline-none transition focus:border-moss"
                  disabled={isLoading}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息…"
                  rows={2}
                  value={inputText}
                />
                <button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-moss text-white transition hover:bg-moss-dark disabled:opacity-50"
                  disabled={isLoading || !inputText.trim()}
                  onClick={handleSend}
                  type="button"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-moss/10">
                <MessageSquarePlus className="h-8 w-8 text-moss" />
              </div>
              <p className="text-sm text-ink/40">选择或创建一个对话</p>
              <button
                className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-dark"
                onClick={handleCreateSession}
                type="button"
              >
                新建对话
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "border border-moss/20 bg-moss/10 text-ink"
            : "border border-line bg-surface-2 text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={`mt-1.5 text-[10px] ${
            isUser ? "text-moss/60" : "text-ink/30"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
