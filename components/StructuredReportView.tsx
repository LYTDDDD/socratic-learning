"use client";

import type { ReactNode } from "react";
import type { AnalyzeResponse } from "../lib/analyze-types";

type StructuredReportViewProps = {
  json: unknown | null;
  parseStatus: AnalyzeResponse["parseStatus"];
  isLoading?: boolean;
};

const dimensionLabels: Record<string, string> = {
  judgment_shift: "Judgment Shift",
  boundary_clarity: "Boundary Clarity",
  transferability: "Transferability",
  hidden_assumption: "Hidden Assumption",
  counterexample_awareness: "Counterexample Awareness",
  framework_formation: "Framework Formation",
  behavior_impact: "Behavior Impact",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = asText(value);
  if (!text) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-ink">{text}</dd>
    </div>
  );
}

function BulletList({ label, values }: { label: string; values: unknown }) {
  const items = asList(values);
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink">
        {items.map((item, index) => (
          <li className="flex gap-2" key={`${label}-${index}`}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScorePill({ score }: { score: unknown }) {
  const value = typeof score === "number" ? score : Number(asText(score));
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
  const tone = safeValue >= 8 ? "bg-moss/15 text-moss" : safeValue >= 6 ? "bg-blue/15 text-blue" : safeValue >= 4 ? "bg-amber/15 text-amber" : "bg-surface-2 text-ink-muted";
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>{safeValue}/10</span>;
}

function MissionReview({ data }: { data: Record<string, unknown> }) {
  const turningPoints = Array.isArray(data.key_turning_points) ? data.key_turning_points.filter(isRecord) : [];
  const assumptions = Array.isArray(data.misconceptions_or_hidden_assumptions)
    ? data.misconceptions_or_hidden_assumptions.filter(isRecord)
    : [];
  const nextAction = asRecord(data.next_action);
  const suggestion = asRecord(data.asset_candidate_suggestion);

  return (
    <Section eyebrow="Mission Review" title="任务复盘">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="原始目标" value={data.original_goal} />
        <Field label="最终判断" value={data.final_judgment} />
      </div>

      {turningPoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">关键转折</p>
          <div className="mt-2 divide-y divide-line rounded-md border border-line">
            {turningPoints.map((item, index) => (
              <div className="p-3" key={index}>
                <p className="text-sm font-semibold text-ink">{asText(item.turning_point) || `转折 ${index + 1}`}</p>
                <Field label="证据" value={item.evidence} />
                <Field label="重要性" value={item.why_it_matters} />
              </div>
            ))}
          </div>
        </div>
      )}

      {assumptions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">误区 / 隐藏假设</p>
          <div className="mt-2 grid gap-2">
            {assumptions.map((item, index) => (
              <div className="rounded-md border border-line px-3 py-2" key={index}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{asText(item.item) || "未命名项"}</span>
                  {asText(item.type) && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-muted">{asText(item.type)}</span>}
                </div>
                <Field label="证据" value={item.evidence} />
                <Field label="修正" value={item.correction} />
                <Field label="不确定性" value={item.uncertainty} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="资产候选建议" value={suggestion.reason} />
        <div>
          <Field label="下一步行动" value={nextAction.action} />
          <Field label="验证方式" value={nextAction.verification_method} />
        </div>
      </div>
    </Section>
  );
}

function DepthEvaluation({ data }: { data: Record<string, unknown> }) {
  const dimensions = asRecord(data.dimension_scores);
  const rows = Object.entries(dimensions).filter(([, value]) => isRecord(value));
  const ruleCheck = asRecord(data.candidate_rule_check);

  return (
    <Section eyebrow="Depth Evaluation" title="深度评估">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Overall Score</p>
          <div className="mt-2"><ScorePill score={data.overall_depth_score} /></div>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="评分理由" value={data.overall_reason} />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-3 py-2">维度</th>
                <th className="px-3 py-2">分数</th>
                <th className="px-3 py-2">证据</th>
                <th className="px-3 py-2">不确定性</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, raw]) => {
                const row = asRecord(raw);
                return (
                  <tr className="border-t border-line align-top" key={key}>
                    <td className="px-3 py-2 font-medium text-ink">{dimensionLabels[key] ?? key}</td>
                    <td className="px-3 py-2"><ScorePill score={row.score} /></td>
                    <td className="px-3 py-2 leading-6 text-ink">{asText(row.evidence) || "-"}</td>
                    <td className="px-3 py-2 leading-6 text-ink-muted">{asText(row.uncertainty) || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border border-line px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">候选规则检查</p>
        <div className="mt-2 grid gap-2 text-sm text-ink sm:grid-cols-3">
          <span>Depth {" >= "} 6: {asText(ruleCheck.depth_score_gte_6) || "-"}</span>
          <span>2+ 证据维度: {asText(ruleCheck.at_least_2_dimensions_with_evidence) || "-"}</span>
          <span>Qualified: {asText(ruleCheck.qualified) || "-"}</span>
        </div>
        <Field label="原因" value={ruleCheck.reason} />
      </div>
    </Section>
  );
}

function AssetDecision({ data, updateProposal }: { data: Record<string, unknown>; updateProposal: Record<string, unknown> }) {
  const pkg = asRecord(data.asset_candidate_package);
  const draft = asRecord(pkg.draft_asset);
  const connectionLayer = asRecord(draft.connection_layer);

  return (
    <Section eyebrow="Asset Decision" title="资产决策">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line px-3 py-2">
          <p className="text-xs text-ink-muted">候选</p>
          <p className="mt-1 text-sm font-semibold text-ink">{asText(data.asset_candidate) || "false"}</p>
        </div>
        <div className="rounded-md border border-line px-3 py-2">
          <p className="text-xs text-ink-muted">类型</p>
          <p className="mt-1 text-sm font-semibold text-ink">{asText(data.recommended_asset_type) || "none"}</p>
        </div>
        <div className="rounded-md border border-line px-3 py-2">
          <p className="text-xs text-ink-muted">成熟度</p>
          <p className="mt-1 text-sm font-semibold text-ink">{asText(data.recommended_maturity) || "none"}</p>
        </div>
      </div>
      <Field label="为什么值得保存" value={data.why_worth_saving} />

      {Object.keys(draft).length > 0 && (
        <div className="rounded-md border border-blue/20 bg-blue/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue">Draft Asset</p>
          <h3 className="mt-1 text-base font-semibold text-ink">{asText(draft.title) || "未命名资产候选"}</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <Field label="核心洞察" value={draft.core_insight} />
            <Field label="AI 摘要" value={draft.ai_generated_summary} />
            <Field label="理解提示" value={draft.my_understanding_prompt} />
            <Field label="解决的问题" value={draft.problem_it_solves} />
            <Field label="原始判断" value={draft.original_judgment} />
            <Field label="修正后判断" value={draft.revised_judgment} />
            <Field label="可迁移价值" value={draft.transferable_value} />
            <Field label="使用证据提示" value={draft.usage_evidence_prompt} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <BulletList label="复习问题" values={draft.review_questions} />
            <BulletList label="连接问题" values={draft.connection_questions} />
            <BulletList label="应用问题" values={draft.application_questions} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BulletList label="相关概念" values={connectionLayer.related_concepts} />
            <BulletList label="相关资产" values={connectionLayer.related_assets} />
            <BulletList label="思维模型" values={connectionLayer.mental_models} />
            <BulletList label="应用场景" values={connectionLayer.application_scenarios} />
          </div>
        </div>
      )}

      {Object.keys(updateProposal).length > 0 && (
        <div className="rounded-md border border-line px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">资产更新建议</p>
          <Field label="建议动作" value={updateProposal.suggested_action} />
          <Field label="原因" value={updateProposal.reason} />
          <BulletList label="证据" values={updateProposal.evidence} />
        </div>
      )}
    </Section>
  );
}

function TraceSummary({ data }: { data: Record<string, unknown> }) {
  return (
    <Section eyebrow="Trace Summary" title="判断依据摘要">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="识别到任务" value={data.mission_detected} />
        <BulletList label="分析路径" values={data.analysis_path} />
        <BulletList label="关键证据" values={data.key_evidence_used} />
        <BulletList label="策略检查" values={data.policy_checks} />
        <BulletList label="不确定性" values={data.uncertainties} />
      </div>
    </Section>
  );
}

export function StructuredReportView({ json, parseStatus, isLoading }: StructuredReportViewProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-surface-1 text-sm text-ink-muted">
        正在等待结构化报告。
      </div>
    );
  }

  if (parseStatus === "failed") {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-md border border-amber/30 bg-amber/5 text-sm text-amber">
        JSON 解析失败，无法渲染结构化报告。
      </div>
    );
  }

  if (parseStatus === "not_attempted" || !json) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-surface-1 text-sm text-ink-muted">
        暂无结构化报告。提交输入后，系统会从 JSON 渲染 Mission Review、Depth Evaluation 与 Asset Decision。
      </div>
    );
  }

  const root = asRecord(json);
  const missionReview = asRecord(root.mission_review);
  const depthEvaluation = asRecord(root.depth_evaluation);
  const assetDecision = asRecord(root.asset_decision);
  const traceSummary = asRecord(root.trace_summary);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-1">
      <div className="border-b border-line px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue">Structured Report</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">离线任务分析报告</h1>
        <p className="mt-1 text-sm text-ink-muted">由 JSON 渲染，JSON 仍是唯一事实来源。</p>
      </div>
      <MissionReview data={missionReview} />
      <DepthEvaluation data={depthEvaluation} />
      <AssetDecision data={assetDecision} updateProposal={asRecord(missionReview.asset_update_proposal)} />
      <TraceSummary data={traceSummary} />
    </div>
  );
}
