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
import { Send, MessageSquarePlus, Trash2, Sparkles, Zap, ArrowRight, ClipboardList } from "lucide-react";

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
  const activeMessageCount = activeSession?.messages.length ?? 0;
  const userMessageCount = activeSession?.messages.filter((m) => m.role === "user").length ?? 0;
  const assistantMessageCount = activeSession?.messages.filter((m) => m.role === "assistant").length ?? 0;
  const canHandoffToReview = Boolean(activeSession && activeMessageCount > 0);

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
        const currentSession = loadChatSessions().find((s) => s.id === activeSessionId);
        onReviewTriggered(activeSessionId, currentSession?.missionId ?? null);
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
    <div className="flex h-full min-w-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface-1 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="border-b border-line px-5 py-4">
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Conversation Workspace</p>
            <h2 className="mt-1 text-sm font-semibold text-ink">对话工作台</h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">先对话澄清问题，再把完整上下文交给离线任务分析。</p>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{sessions.length}</p>
              <p className="text-[10px] text-ink-muted">sessions</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{sessions.filter((s) => s.missionId).length}</p>
              <p className="text-[10px] text-ink-muted">missions</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
              <p className="text-sm font-semibold text-ink">{sessions.filter((s) => s.messages.some((m) => m.reviewTriggered)).length}</p>
              <p className="text-[10px] text-ink-muted">handoffs</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted/60">对话列表</h3>
          <button
            aria-label="新建对话"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue transition hover:bg-blue/10"
            onClick={handleCreateSession}
            title="新建对话"
            type="button"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            新建
          </button>
          </div>
        </div>

        <div className="max-h-72 flex-1 overflow-auto lg:max-h-none">
          {sessions.length === 0 && (
            <p className="px-5 py-5 text-xs text-ink-muted/50">暂无对话，点击"新建"开始。</p>
          )}
          {sessions.map((session) => {
            const lastMsg = session.messages[session.messages.length - 1];
            const mission = session.missionId ? getMissionById(session.missionId) : null;
            return (
              <div
                key={session.id}
                className={`group cursor-pointer px-5 py-3 transition ${
                  activeSessionId === session.id
                    ? "border-l-2 border-l-blue bg-surface-2"
                    : "hover:bg-surface-2/50"
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
                    aria-label={`删除对话：${session.title}`}
                    className="shrink-0 rounded-lg p-1 text-ink-muted/50 opacity-0 transition hover:text-amber group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    title="删除对话"
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {mission && (
                  <span className="mt-1.5 inline-block rounded-lg bg-blue/20 px-2 py-0.5 text-[10px] text-blue/70">
                    {mission.title}
                  </span>
                )}
                {lastMsg && (
                  <p className="mt-1.5 truncate text-[11px] text-ink-muted/50">
                    {lastMsg.content.slice(0, 50)}
                    {lastMsg.content.length > 50 ? "..." : ""}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-ink-muted/30">
                  {new Date(session.updatedAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex min-h-[560px] min-w-0 flex-1 flex-col bg-surface-1">
        {activeSession ? (
          <>
            <header className="shrink-0 border-b border-line px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Active Conversation</p>
                  <h3 className="mt-1 truncate font-heading text-sm font-semibold text-ink">{activeSession.title}</h3>
                  {activeSession.missionId && (() => {
                    const m = getMissionById(activeSession.missionId);
                    return m ? (
                      <span className="mt-2 inline-block rounded-full bg-blue/10 px-2.5 py-1 text-[11px] font-medium text-blue">
                        Mission: {m.title}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="grid min-w-48 grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <p className="text-sm font-semibold text-ink">{activeMessageCount}</p>
                    <p className="text-[10px] text-ink-muted">turns</p>
                  </div>
                  <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <p className="text-sm font-semibold text-ink">{userMessageCount}</p>
                    <p className="text-[10px] text-ink-muted">user</p>
                  </div>
                  <div className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <p className="text-sm font-semibold text-ink">{assistantMessageCount}</p>
                    <p className="text-[10px] text-ink-muted">assistant</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                <ClipboardList className="h-4 w-4 text-blue" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Review Handoff</p>
                  <p className="text-xs text-ink-muted">把当前对话填入离线任务分析，生成 Mission Review、DepthScore 与资产候选。</p>
                </div>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue/80 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-muted/50"
                  disabled={!canHandoffToReview}
                  onClick={() => {
                    if (onReviewTriggered) {
                      onReviewTriggered(activeSession.id, activeSession.missionId);
                    }
                  }}
                  type="button"
                >
                  发送到离线分析
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>

            {hasReviewTriggered && (
              <div className="flex items-center gap-2 border border-amber/20 bg-amber/10 px-5 py-3">
                <Zap className="h-4 w-4 shrink-0 text-amber" />
                <span className="text-xs font-medium text-amber">复盘已触发，点击此处生成 Mission Review</span>
                <button
                  className="rounded-lg bg-amber px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-amber/80"
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue/10">
                    <Sparkles className="h-8 w-8 text-blue" />
                  </div>
                  <p className="text-sm text-ink-muted/70">开始对话吧</p>
                </div>
              )}
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="mb-4 flex items-start gap-2">
                  <div className="rounded-2xl bg-surface-2 px-4 py-3">
                    <span className="text-xs text-ink-muted">正在思考…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-line px-5 py-4">
              <div className="flex items-end gap-3">
                <textarea
                  className="flex-1 resize-none rounded-2xl border-0 bg-surface-2/80 px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 focus:ring-blue/30"
                  disabled={isLoading}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息…"
                  rows={2}
                  value={inputText}
                />
                <button
                  aria-label="发送"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue text-white transition hover:bg-blue/80 disabled:opacity-50"
                  disabled={isLoading || !inputText.trim()}
                  onClick={handleSend}
                  title="发送"
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
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue/10">
                <MessageSquarePlus className="h-10 w-10 text-blue" />
              </div>
              <p className="text-sm text-ink-muted/70">选择或创建一个对话</p>
              <button
                className="rounded-xl bg-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue/80"
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
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue text-white"
            : "bg-surface-2 text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={`mt-1.5 text-[10px] ${
            isUser ? "text-ink-muted" : "text-ink-muted/50"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
