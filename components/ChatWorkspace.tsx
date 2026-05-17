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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `HTTP ${res.status}`;
        throw new Error(errorMessage);
      }

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
    <div className="grid h-full gap-0 xl:grid-cols-[260px_1fr]">
      <aside className="flex flex-col border-r border-line bg-paper/60">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h3 className="text-sm font-semibold text-ink">对话列表</h3>
          <button
            className="rounded border border-moss/30 px-2 py-0.5 text-[10px] font-medium text-moss transition hover:bg-moss/10"
            onClick={handleCreateSession}
            type="button"
          >
            新建对话
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {sessions.length === 0 && (
            <p className="px-3 py-4 text-xs text-ink/40">暂无对话，点击"新建对话"开始。</p>
          )}
          {sessions.map((session) => {
            const lastMsg = session.messages[session.messages.length - 1];
            const mission = session.missionId ? getMissionById(session.missionId) : null;
            return (
              <div
                key={session.id}
                className={`group cursor-pointer border-b border-line px-3 py-2 transition ${
                  activeSessionId === session.id
                    ? "bg-moss/10 border-l-2 border-l-moss"
                    : "hover:bg-paper"
                }`}
                onClick={() => setActiveSessionId(session.id)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-1">
                  <span className="flex-1 truncate text-xs font-medium text-ink">
                    {session.title}
                  </span>
                  <button
                    className="shrink-0 rounded border border-rust/30 px-1 py-0.5 text-[9px] font-medium text-rust opacity-0 transition hover:bg-rust/10 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </div>
                {mission && (
                  <span className="inline-block mt-0.5 rounded bg-moss/10 px-1.5 py-0.5 text-[9px] text-moss">
                    {mission.title}
                  </span>
                )}
                {lastMsg && (
                  <p className="mt-0.5 truncate text-[10px] text-ink/40">
                    {lastMsg.content.slice(0, 50)}
                    {lastMsg.content.length > 50 ? "..." : ""}
                  </p>
                )}
                <p className="mt-0.5 text-[9px] text-ink/30">
                  {new Date(session.updatedAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col bg-white/80">
        {activeSession ? (
          <>
            <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
              <h3 className="text-sm font-semibold text-ink">{activeSession.title}</h3>
              {activeSession.missionId && (() => {
                const m = getMissionById(activeSession.missionId);
                return m ? (
                  <span className="inline-block rounded bg-moss/10 px-2 py-0.5 text-[10px] font-medium text-moss">
                    Mission: {m.title}
                  </span>
                ) : null;
              })()}
            </header>

            {hasReviewTriggered && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
                <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-medium text-amber-700">复盘已触发，点击此处生成 Mission Review</span>
                <button
                  className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-amber-700"
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

            <div className="flex-1 overflow-auto px-4 py-3">
              {activeSession.messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-ink/30">开始对话吧</p>
                </div>
              )}
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="mb-3 flex items-start gap-2">
                  <div className="rounded-lg border border-line bg-paper/60 px-3 py-2">
                    <span className="text-xs text-ink/50">正在思考…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-line px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  className="flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-moss"
                  disabled={isLoading}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息…"
                  rows={2}
                  value={inputText}
                />
                <button
                  className="shrink-0 rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
                  disabled={isLoading || !inputText.trim()}
                  onClick={handleSend}
                  type="button"
                >
                  发送
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-ink/40">选择或创建一个对话</p>
              <button
                className="mt-3 rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss/90"
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
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-moss text-white"
            : "border border-line bg-paper/60 text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={`mt-1 text-[10px] ${
            isUser ? "text-white/60" : "text-ink/30"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
