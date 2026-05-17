"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { getSessionById } from "@/lib/chat-store";
import type { AnalyzeInput } from "@/lib/analyze-types";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const AnalysisWorkbench = dynamic(() => import("@/components/AnalysisWorkbench").then((m) => ({ default: m.AnalysisWorkbench })), { ssr: false });
const ChatWorkspace = dynamic(() => import("@/components/ChatWorkspace").then((m) => ({ default: m.ChatWorkspace })), { ssr: false });

type WorkspaceMode = "analysis" | "chat";

export default function LabPage() {
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
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6">
        <header className="border-b border-line pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink/50 transition hover:bg-paper-warm hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                首页
              </Link>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rust">
                  Cognitive Asset Lab
                </p>
                <h1 className="mt-1 text-2xl font-semibold leading-tight md:text-3xl">
                  {mode === "analysis" ? "离线任务分析工作台" : "聊天工作台"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
              <button
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  mode === "analysis"
                    ? "bg-moss text-white"
                    : "text-ink/50 hover:text-ink"
                }`}
                onClick={() => setMode("analysis")}
                type="button"
              >
                离线分析
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  mode === "chat"
                    ? "bg-moss text-white"
                    : "text-ink/50 hover:text-ink"
                }`}
                onClick={() => setMode("chat")}
                type="button"
              >
                聊天工作台
              </button>
            </div>
          </div>
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
