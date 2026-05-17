"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FlaskConical, MessageCircle } from "lucide-react";
import { getSessionById } from "../lib/chat-store";
import type { AnalyzeInput } from "../lib/analyze-types";

const AnalysisWorkbench = dynamic(() => import("../components/AnalysisWorkbench").then((m) => ({ default: m.AnalysisWorkbench })), { ssr: false });
const ChatWorkspace = dynamic(() => import("../components/ChatWorkspace").then((m) => ({ default: m.ChatWorkspace })), { ssr: false });

type WorkspaceMode = "analysis" | "chat";

export default function Home() {
  const [mode, setMode] = useState<WorkspaceMode>("analysis");
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(null);
  const [initialInputOverride, setInitialInputOverride] = useState<Partial<AnalyzeInput> | undefined>(undefined);

  function handleReviewTriggered(sessionId: string, missionId: string | null) {
    setCurrentMissionId(missionId);
    const session = getSessionById(sessionId);
    if (session && session.messages.length > 0) {
      const conversation = session.messages
        .map((m) => `${m.role === "user" ? "用户" : "助手"}：${m.content}`)
        .join("\n\n");
      const lastUserMsg = [...session.messages].reverse().find((m) => m.role === "user");
      setInitialInputOverride({
        conversation,
        originalGoal: lastUserMsg?.content ?? "",
      });
    } else {
      setInitialInputOverride(undefined);
    }
    setMode("analysis");
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <nav className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-5 w-5 text-rust" />
            <span className="font-heading text-base font-semibold tracking-wide text-ink">
              Cognitive Asset Lab
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface-1 p-1">
            <button
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === "analysis"
                  ? "bg-moss text-white shadow-sm"
                  : "text-ink/50 hover:text-ink"
              }`}
              onClick={() => setMode("analysis")}
              type="button"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              离线分析
            </button>
            <button
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === "chat"
                  ? "bg-moss text-white shadow-sm"
                  : "text-ink/50 hover:text-ink"
              }`}
              onClick={() => setMode("chat")}
              type="button"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              聊天工作台
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col px-6 py-8">
        <header className="mb-6">
          <h1 className="font-heading text-3xl font-semibold leading-tight md:text-4xl">
            {mode === "analysis" ? "离线任务分析工作台" : "聊天工作台"}
          </h1>
        </header>

        {mode === "analysis" ? (
          <AnalysisWorkbench
            currentMissionId={currentMissionId}
            onSelectMission={setCurrentMissionId}
            initialInputOverride={initialInputOverride}
          />
        ) : (
          <ChatWorkspace
            currentMissionId={currentMissionId}
            onReviewTriggered={handleReviewTriggered}
          />
        )}
      </section>
    </main>
  );
}
