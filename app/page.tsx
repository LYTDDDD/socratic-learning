"use client";

import { useState } from "react";
import { AnalysisWorkbench } from "../components/AnalysisWorkbench";
import { ChatWorkspace } from "../components/ChatWorkspace";

type WorkspaceMode = "analysis" | "chat";

export default function Home() {
  const [mode, setMode] = useState<WorkspaceMode>("analysis");
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(null);

  function handleReviewTriggered(sessionId: string, missionId: string | null) {
    if (missionId) {
      setCurrentMissionId(missionId);
    }
    setMode("analysis");
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6">
        <header className="border-b border-line pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rust">
                Cognitive Asset Lab
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
                {mode === "analysis" ? "离线任务分析工作台" : "聊天工作台"}
              </h1>
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
