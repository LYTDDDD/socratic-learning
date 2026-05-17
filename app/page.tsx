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
    <div className="flex h-screen bg-paper text-ink">
      <aside className="flex w-16 flex-shrink-0 flex-col items-center bg-ink py-4">
        <nav className="flex flex-1 flex-col items-center gap-1">
          <button
            className={`flex h-14 w-full flex-col items-center justify-center transition ${
              mode === "analysis" ? "text-moss" : "text-white/50 hover:text-white/80"
            }`}
            onClick={() => setMode("analysis")}
            type="button"
          >
            <FlaskConical className="h-5 w-5" />
          </button>
          <button
            className={`flex h-14 w-full flex-col items-center justify-center transition ${
              mode === "chat" ? "text-moss" : "text-white/50 hover:text-white/80"
            }`}
            onClick={() => setMode("chat")}
            type="button"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </nav>
        <div className="text-white/20">
          <FlaskConical className="h-4 w-4" />
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
