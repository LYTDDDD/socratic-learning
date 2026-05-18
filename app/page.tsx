"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FlaskConical, MessageCircle, Brain } from "lucide-react";
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
    <div className="flex h-screen bg-paper text-ink">
      <aside className="flex w-14 flex-shrink-0 flex-col items-center border-r border-line bg-surface-1 py-4">
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10">
          <Brain className="h-4 w-4 text-blue" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1">
          <button
            aria-label="打开离线分析工作台"
            className={`flex h-11 w-full flex-col items-center justify-center rounded-lg transition ${
              mode === "analysis"
                ? "text-blue bg-blue/10"
                : "text-ink-muted hover:text-ink hover:bg-surface-2"
            }`}
            onClick={() => setMode("analysis")}
            title="离线分析"
            type="button"
          >
            <FlaskConical className="h-4 w-4" />
          </button>
          <button
            aria-label="打开聊天工作台"
            className={`flex h-11 w-full flex-col items-center justify-center rounded-lg transition ${
              mode === "chat"
                ? "text-blue bg-blue/10"
                : "text-ink-muted hover:text-ink hover:bg-surface-2"
            }`}
            onClick={() => setMode("chat")}
            title="聊天工作台"
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </nav>
        <div className="text-ink-muted/30">
          <FlaskConical className="h-3.5 w-3.5" />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
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
      </main>
    </div>
  );
}
