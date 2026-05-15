"use client";

import { useState } from "react";
import type { AgentStep, AgentType } from "../lib/agent-types";

const agentNameMap: Record<AgentType, string> = {
  supervisor: "编排器",
  review: "复盘",
  depth_evaluation: "深度评估",
  asset: "资产决策",
  curator: "整理建议",
  reflection: "反思建议",
};

function statusBadge(status: AgentStep["status"]) {
  if (status === "success") return "bg-green-100 text-green-800";
  if (status === "failed") return "bg-red-100 text-red-800";
  if (status === "running") return "bg-yellow-100 text-yellow-800";
  return "bg-ink/10 text-ink/50";
}

function statusLabel(status: AgentStep["status"]) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  return "已跳过";
}

function calcDuration(step: AgentStep): string {
  if (!step.finishedAt) return "—";
  const start = new Date(step.startedAt).getTime();
  const end = new Date(step.finishedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function depthScoreColor(score: number): string {
  if (score <= 3) return "bg-red-500";
  if (score <= 5) return "bg-orange-400";
  if (score <= 7) return "bg-yellow-400";
  return "bg-green-500";
}

function SupervisorOutput({ output }: { output: Record<string, unknown> }) {
  const reasoning = output.reasoning as string | undefined;
  const steps = output.steps as unknown[] | undefined;

  return (
    <div className="space-y-3">
      {reasoning && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">编排决策</p>
          <p className="text-sm text-ink">{reasoning}</p>
        </div>
      )}
      {steps && steps.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">执行步骤</p>
          <div className="flex flex-wrap items-center gap-1">
            {steps.map((s, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="rounded bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss">
                  {agentNameMap[s as AgentType] ?? String(s)}
                </span>
                {i < steps.length - 1 && (
                  <svg className="h-3 w-3 text-ink/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewOutput({ output }: { output: Record<string, unknown> }) {
  const summary = output.summary as string | undefined;
  const keyDecisions = output.key_decisions as string[] | undefined;
  const turningPoints = output.turning_points as string[] | undefined;
  const keyTakeaways = output.key_takeaways as string[] | undefined;

  return (
    <div className="space-y-3">
      {summary && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">总结</p>
          <p className="text-sm text-ink">{summary}</p>
        </div>
      )}
      {keyDecisions && keyDecisions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">关键决策</p>
          <ul className="list-inside list-disc space-y-0.5">
            {keyDecisions.map((d, i) => (
              <li key={i} className="text-sm text-ink">{d}</li>
            ))}
          </ul>
        </div>
      )}
      {turningPoints && turningPoints.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">转折点</p>
          <ul className="list-inside list-disc space-y-0.5">
            {turningPoints.map((t, i) => (
              <li key={i} className="text-sm text-ink">{t}</li>
            ))}
          </ul>
        </div>
      )}
      {keyTakeaways && keyTakeaways.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">核心收获</p>
          <ul className="list-inside list-disc space-y-0.5">
            {keyTakeaways.map((k, i) => (
              <li key={i} className="text-sm text-ink">{k}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DepthEvaluationOutput({ output }: { output: Record<string, unknown> }) {
  const depthScore = output.depth_score as number | undefined;
  const blindSpots = output.blind_spots as string[] | undefined;
  const improvementDirections = output.improvement_directions as string[] | undefined;
  const reasoning = output.reasoning as string | undefined;

  return (
    <div className="space-y-3">
      {depthScore != null && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">深度评分</p>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full rounded-full transition-all ${depthScoreColor(depthScore)}`}
                style={{ width: `${(depthScore / 10) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-ink">{depthScore}/10</span>
          </div>
        </div>
      )}
      {blindSpots && blindSpots.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">盲点</p>
          <ul className="list-inside list-disc space-y-0.5">
            {blindSpots.map((b, i) => (
              <li key={i} className="text-sm text-ink">{b}</li>
            ))}
          </ul>
        </div>
      )}
      {improvementDirections && improvementDirections.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">改进方向</p>
          <ul className="list-inside list-disc space-y-0.5">
            {improvementDirections.map((d, i) => (
              <li key={i} className="text-sm text-ink">{d}</li>
            ))}
          </ul>
        </div>
      )}
      {reasoning && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">评估理由</p>
          <p className="text-sm text-ink">{reasoning}</p>
        </div>
      )}
    </div>
  );
}

function AssetOutput({ output }: { output: Record<string, unknown> }) {
  const hasAsset = output.has_asset as boolean | undefined;
  const assetType = output.asset_type as string | undefined;
  const title = output.title as string | undefined;
  const coreInsight = output.core_insight as string | undefined;
  const transferableValue = output.transferable_value as string | undefined;

  return (
    <div className="space-y-3">
      {hasAsset != null && (
        <div className="flex items-center gap-2">
          {hasAsset ? (
            <svg className="h-5 w-5 text-moss" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-rust" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className="text-sm font-medium text-ink">
            {hasAsset ? "值得提取" : "不建议提取"}
          </span>
        </div>
      )}
      {assetType && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">资产类型</p>
          <span className="inline-block rounded bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss">
            {assetType}
          </span>
        </div>
      )}
      {title && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">标题</p>
          <p className="text-sm text-ink">{title}</p>
        </div>
      )}
      {coreInsight && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">核心洞察</p>
          <p className="text-sm text-ink">{coreInsight}</p>
        </div>
      )}
      {transferableValue && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">可迁移价值</p>
          <p className="text-sm text-ink">{transferableValue}</p>
        </div>
      )}
    </div>
  );
}

function CuratorOutput({ output }: { output: Record<string, unknown> }) {
  const connections = output.connections as Array<Record<string, unknown>> | undefined;
  const organizationTips = output.organization_tips as string[] | undefined;
  const suggestedTags = output.suggested_tags as string[] | undefined;

  return (
    <div className="space-y-3">
      {connections && connections.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">关联建议</p>
          <div className="space-y-1">
            {connections.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm text-ink">
                <span>{String(c.source_concept ?? "")}</span>
                <svg className="h-3 w-3 text-ink/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{String(c.target_concept ?? "")}</span>
                <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/50">
                  {String(c.connection_type ?? "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {organizationTips && organizationTips.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">整理建议</p>
          <ul className="list-inside list-disc space-y-0.5">
            {organizationTips.map((t, i) => (
              <li key={i} className="text-sm text-ink">{t}</li>
            ))}
          </ul>
        </div>
      )}
      {suggestedTags && suggestedTags.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">建议标签</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTags.map((tag, i) => (
              <span key={i} className="rounded bg-moss/10 px-2 py-0.5 text-xs text-moss">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReflectionOutput({ output }: { output: Record<string, unknown> }) {
  const reflectionQuestions = output.reflection_questions as string[] | undefined;
  const actionItems = output.action_items as string[] | undefined;
  const mindsetShifts = output.mindset_shifts as string[] | undefined;

  return (
    <div className="space-y-3">
      {reflectionQuestions && reflectionQuestions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">反思问题</p>
          <ul className="list-inside list-disc space-y-0.5">
            {reflectionQuestions.map((q, i) => (
              <li key={i} className="text-sm text-ink">{q}</li>
            ))}
          </ul>
        </div>
      )}
      {actionItems && actionItems.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">行动建议</p>
          <ul className="list-inside list-disc space-y-0.5">
            {actionItems.map((a, i) => (
              <li key={i} className="text-sm text-ink">{a}</li>
            ))}
          </ul>
        </div>
      )}
      {mindsetShifts && mindsetShifts.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink/60">思维转变</p>
          <ul className="list-inside list-disc space-y-0.5">
            {mindsetShifts.map((m, i) => (
              <li key={i} className="text-sm text-ink">{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AgentOutputContent({ agent, output }: { agent: AgentType; output: Record<string, unknown> }) {
  switch (agent) {
    case "supervisor":
      return <SupervisorOutput output={output} />;
    case "review":
      return <ReviewOutput output={output} />;
    case "depth_evaluation":
      return <DepthEvaluationOutput output={output} />;
    case "asset":
      return <AssetOutput output={output} />;
    case "curator":
      return <CuratorOutput output={output} />;
    case "reflection":
      return <ReflectionOutput output={output} />;
  }
}

function AgentCard({ step, defaultExpanded }: { step: AgentStep; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const output = step.output ?? {};

  return (
    <div className="rounded-lg border border-line bg-paper/60">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-paper/80"
        onClick={() => setExpanded((e) => !e)}
        type="button"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-ink/40 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-semibold text-ink">{agentNameMap[step.agent]}</span>
        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${statusBadge(step.status)}`}>
          {statusLabel(step.status)}
        </span>
        <span className="ml-auto text-xs text-ink/40">{calcDuration(step)}</span>
      </button>
      {expanded && (
        <div className="border-t border-line px-4 py-3">
          {step.status === "success" && step.output ? (
            <AgentOutputContent agent={step.agent} output={output} />
          ) : step.status === "failed" && step.error ? (
            <p className="text-sm text-rust">{step.error}</p>
          ) : (
            <p className="text-sm text-ink/40">无输出</p>
          )}
        </div>
      )}
    </div>
  );
}

type AgentOutputCardsProps = {
  steps: AgentStep[];
  json: Record<string, unknown>;
};

export function AgentOutputCards({ steps }: AgentOutputCardsProps) {
  const successSteps = steps.filter((s) => s.status === "success" && s.output);

  if (successSteps.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-line bg-paper text-sm text-ink/50">
        暂无 Agent 输出
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {successSteps.map((step, i) => (
        <AgentCard key={step.agent} step={step} defaultExpanded={i === 0} />
      ))}
    </div>
  );
}
