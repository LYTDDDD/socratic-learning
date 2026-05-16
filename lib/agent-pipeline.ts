import type { AgentContext, AgentStep, AgentType, RetryOptions } from "./agent-types";
import type { ConnectionLayer } from "./extract-asset";
import { ASSET_TYPE_MAP } from "./agent-types";
import { supervisorAgent, createStep, completeStep, failStep } from "./supervisor-agent";
import { reviewAgent } from "./review-agent";
import { depthEvaluationAgent } from "./depth-evaluation-agent";
import { assetAgent } from "./asset-agent";
import { curatorAgent } from "./curator-agent";
import { reflectionAgent } from "./reflection-agent";

export type PipelineCallbacks = {
  onStepStart?: (agent: AgentType, index: number, total: number) => void;
  onStepComplete?: (agent: AgentType, index: number, total: number, durationMs: number) => void;
  onStepError?: (agent: AgentType, index: number, total: number, error: string) => void;
  onStepRetry?: (agent: AgentType, index: number, total: number, attempt: number) => void;
};

const agentRegistry: Record<AgentType, typeof supervisorAgent> = {
  supervisor: supervisorAgent,
  review: reviewAgent,
  depth_evaluation: depthEvaluationAgent,
  asset: assetAgent,
  curator: curatorAgent,
  reflection: reflectionAgent,
};

const AGENT_TIMEOUT_MS = 60000;

export async function runAgentPipeline(
  input: AgentContext["input"],
  callbacks?: PipelineCallbacks,
  retryOptions?: RetryOptions,
  signal?: AbortSignal,
): Promise<{ steps: AgentStep[]; supervisorDecision: string }> {
  const steps: AgentStep[] = [];
  const context: AgentContext = { input, previousSteps: steps, signal };

  const supervisorStep = createStep(supervisorAgent, { input });
  steps.push(supervisorStep);

  callbacks?.onStepStart?.("supervisor", 0, 0);
  const supervisorStartTime = Date.now();

  let supervisorOutput: Record<string, unknown>;
  try {
    supervisorOutput = await supervisorAgent.execute(context);
    steps[0] = completeStep(steps[0], supervisorOutput);
    callbacks?.onStepComplete?.("supervisor", 0, 0, Date.now() - supervisorStartTime);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Supervisor failed";
    console.error("[AgentPipeline] Supervisor failed:", errMsg);
    steps[0] = failStep(steps[0], errMsg);
    callbacks?.onStepError?.("supervisor", 0, 0, errMsg);
    supervisorOutput = {
      steps: ["review", "depth_evaluation", "asset", "curator", "reflection"],
      reasoning: "Supervisor failed, using default full pipeline",
    };
  }

  const validAgentTypes: AgentType[] = ["review", "depth_evaluation", "asset", "curator", "reflection"];
  let plannedSteps = ((supervisorOutput.steps as unknown[]) ?? [
    "review",
    "depth_evaluation",
    "asset",
    "curator",
    "reflection",
  ])
    .filter((s): s is string => typeof s === "string" && validAgentTypes.includes(s as AgentType))
    .filter((v, i, a) => a.indexOf(v) === i);

  if (plannedSteps.length === 0) {
    plannedSteps.push("review", "asset");
  }
  const supervisorDecision =
    (supervisorOutput.reasoning as string) ?? "No reasoning provided";

  const total = plannedSteps.length;

  for (let stepIdx = 0; stepIdx < plannedSteps.length; stepIdx++) {
    const stepType = plannedSteps[stepIdx];
    if (stepType === "supervisor") continue;

    if (signal?.aborted) {
      return { steps, supervisorDecision };
    }

    if (stepType === "asset") {
      const depthStep = steps.find((s) => s.agent === "depth_evaluation" && s.status === "success");
      if (depthStep?.output) {
        const depthOutput = depthStep.output as Record<string, unknown>;
        const depthScore = typeof depthOutput.depth_score === "number" ? depthOutput.depth_score : 0;
        const hasEvidence = Array.isArray(depthOutput.blind_spots) && depthOutput.blind_spots.length > 0;
        if (depthScore < 6 && !hasEvidence) {
          const callbackIndex = stepIdx + 1;
          callbacks?.onStepStart?.(stepType as AgentType, callbackIndex, total);
          steps.push({
            agent: stepType,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            input: {},
            output: { has_asset: false, reasoning: `深度评分 ${depthScore} 低于门槛（6），且无充分证据支持资产提取` },
            status: "success",
            error: null,
          });
          callbacks?.onStepComplete?.(stepType as AgentType, callbackIndex, total, 0);
          continue;
        }
      }
    }

    const agent = agentRegistry[stepType as AgentType];
    if (!agent) continue;

    const stepInput: Record<string, unknown> = { input };
    const step = createStep(agent, stepInput);
    steps.push(step);

    const callbackIndex = stepIdx + 1;
    callbacks?.onStepStart?.(stepType as AgentType, callbackIndex, total);
    const stepStartTime = Date.now();

    const maxRetries = retryOptions?.maxRetries ?? 0;
    const retryDelayMs = retryOptions?.retryDelayMs ?? 1000;
    let lastError: string | null = null;
    let succeeded = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const outputPromise = agent.execute({ input, previousSteps: steps, signal });
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Agent "${stepType}" timed out after ${AGENT_TIMEOUT_MS / 1000}s`)), AGENT_TIMEOUT_MS);
        });
        try {
          const output = await Promise.race([outputPromise, timeoutPromise]);
          steps[steps.length - 1] = completeStep(steps[steps.length - 1], output);
          callbacks?.onStepComplete?.(stepType as AgentType, callbackIndex, total, Date.now() - stepStartTime);
          succeeded = true;
          break;
        } finally {
          clearTimeout(timeoutId!);
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : `${stepType} agent failed`;
        if (signal?.aborted) {
          steps[steps.length - 1] = failStep(steps[steps.length - 1], lastError ?? "Request aborted");
          callbacks?.onStepError?.(stepType as AgentType, callbackIndex, total, lastError ?? "Request aborted");
          return { steps, supervisorDecision };
        }
        if (attempt < maxRetries) {
          callbacks?.onStepRetry?.(stepType as AgentType, callbackIndex, total, attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    if (!succeeded) {
      console.error(`[AgentPipeline] Agent "${stepType}" failed after ${maxRetries + 1} attempts:`, lastError);
      steps[steps.length - 1] = failStep(steps[steps.length - 1], lastError ?? `${stepType} agent failed`);
      callbacks?.onStepError?.(stepType as AgentType, callbackIndex, total, lastError ?? `${stepType} agent failed`);
    }
  }

  return { steps, supervisorDecision };
}

function extractPreferenceRules(steps: AgentStep[]): string[] {
  for (const step of steps) {
    const stepInput = step.input as Record<string, unknown> | undefined;
    const pipelineInput = stepInput?.input as { preferenceRules?: string[] } | undefined;
    if (pipelineInput?.preferenceRules && Array.isArray(pipelineInput.preferenceRules)) {
      return pipelineInput.preferenceRules;
    }
  }
  return [];
}

function curatorConnectionsToConnectionLayer(
  connections: Array<Record<string, string>>,
): ConnectionLayer {
  const layer: ConnectionLayer = {
    related_concepts: [],
    related_assets: [],
    mental_models: [],
    prior_experience: [],
    opposite_cases: [],
    application_scenarios: [],
    open_questions: [],
  };

  const CONNECTION_TYPE_MAP: Record<string, keyof ConnectionLayer> = {
    "因果": "related_concepts",
    "类比": "mental_models",
    "对比": "opposite_cases",
    "层级": "related_concepts",
    "时序": "prior_experience",
    "应用": "application_scenarios",
    "问题": "open_questions",
    "concept": "related_concepts",
    "model": "mental_models",
    "experience": "prior_experience",
    "opposite": "opposite_cases",
    "application": "application_scenarios",
    "question": "open_questions",
    "asset": "related_assets",
  };

  for (const c of connections) {
    const target = c.target_concept ?? "";
    if (!target) continue;
    const type = (c.connection_type ?? "").toLowerCase();
    let matched = false;
    for (const [key, field] of Object.entries(CONNECTION_TYPE_MAP)) {
      if (type.includes(key)) {
        layer[field].push(target);
        matched = true;
        break;
      }
    }
    if (!matched) {
      layer.related_concepts.push(target);
    }
  }

  return layer;
}

export function buildMultiAgentJson(steps: AgentStep[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const step of steps) {
    if (step.status === "success" && step.output) {
      result[step.agent] = step.output;
    }
  }

  if (result.review) {
    result.mission_review = result.review;
  }

  if (result.asset) {
    const a = result.asset as Record<string, unknown>;
    const draftAsset: Record<string, unknown> = {};
    if (typeof a.title === "string") draftAsset.title = a.title;
    if (typeof a.core_insight === "string") draftAsset.core_insight = a.core_insight;
    if (typeof a.original_judgment === "string") draftAsset.original_judgment = a.original_judgment;
    if (typeof a.revised_judgment === "string") draftAsset.revised_judgment = a.revised_judgment;
    if (typeof a.my_understanding === "string") draftAsset.my_understanding = a.my_understanding;
    if (typeof a.transferable_value === "string") draftAsset.transferable_value = a.transferable_value;
    if (typeof a.asset_type === "string") draftAsset.type = ASSET_TYPE_MAP[a.asset_type] ?? "ConceptCard";

    const specialFields = a.special_fields as Record<string, unknown> | undefined;
    if (specialFields && Object.keys(specialFields).length > 0) {
      draftAsset.special_fields = specialFields;
    }

    const curatorOutput = result.curator as Record<string, unknown> | undefined;
    const curatorConnections = curatorOutput?.connections;
    if (Array.isArray(curatorConnections) && curatorConnections.length > 0) {
      const connectionLayer = curatorConnectionsToConnectionLayer(
        curatorConnections as Array<Record<string, string>>,
      );
      draftAsset.ai_suggested_connections = connectionLayer;
      draftAsset.connection_layer = connectionLayer;
    }

    result.asset_decision = {
      asset_candidate: a.has_asset === true,
      recommended_asset_type: (a.asset_type ? ASSET_TYPE_MAP[a.asset_type as string] ?? "ConceptCard" : ""),
      title: a.title ?? "",
      core_insight: a.core_insight ?? "",
      original_judgment: a.original_judgment ?? "",
      revised_judgment: a.revised_judgment ?? "",
      my_understanding: a.my_understanding ?? "",
      transferable_value: a.transferable_value ?? "",
      reasoning: a.reasoning ?? "",
      asset_candidate_package: a.has_asset === true
        ? {
            summary: a.core_insight ?? "",
            judgment_change: {
              before: a.original_judgment ?? "",
              after: a.revised_judgment ?? "",
              trigger: "",
            },
            draft_asset: draftAsset,
          }
        : null,
    };
  }

  if (steps.length > 0) {
    const supervisorStep = steps.find((s) => s.agent === "supervisor" && s.status === "success");
    const successfulAgents = steps
      .filter((s) => s.status === "success" && s.agent !== "supervisor")
      .map((s) => s.agent);
    const failedErrors = steps
      .filter((s) => s.status === "failed" && s.error)
      .map((s) => s.error as string);
    const preferenceRules = extractPreferenceRules(steps);

    result.trace_summary = {
      mission_detected: true,
      analysis_path: successfulAgents.join(" → "),
      key_evidence_used: (supervisorStep?.output?.reasoning as string) ?? "",
      policy_checks: preferenceRules.length > 0
        ? `已应用 ${preferenceRules.length} 条偏好规则`
        : "无偏好规则",
      uncertainties: failedErrors,
    };
  }

  return result;
}

export function buildMultiAgentMarkdown(steps: AgentStep[]): string {
  const sections: string[] = [];

  const curatorStep = steps.find(s => s.agent === "curator" && s.status === "success");
  const curatorConnections = curatorStep?.output?.connections ?? null;

  for (const step of steps) {
    if (step.status !== "success" || !step.output) continue;

    const agent = agentRegistry[step.agent];
    const title = agent?.name ?? step.agent;

    sections.push(`## ${title}`);
    sections.push("");

    if (step.agent === "supervisor") {
      sections.push(`**编排决策**：${step.output.reasoning ?? "—"}`);
      sections.push(`**执行步骤**：${(step.output.steps as string[])?.join(" → ") ?? "—"}`);
    } else if (step.agent === "review") {
      const o = step.output;
      sections.push(`**总结**：${o.summary ?? "—"}`);
      if (Array.isArray(o.key_decisions)) {
        sections.push("");
        sections.push("### 关键决策");
        for (const d of o.key_decisions as string[]) sections.push(`- ${d}`);
      }
      if (Array.isArray(o.turning_points)) {
        sections.push("");
        sections.push("### 关键转折");
        for (let ti = 0; ti < o.turning_points.length; ti++) {
          const tp = o.turning_points[ti] as Record<string, string>;
          if (typeof tp === "object" && tp !== null && typeof tp.turning_point === "string") {
            sections.push(`- **转折${ti + 1}**：${tp.turning_point}`);
            if (tp.evidence) sections.push(`  - 证据：${tp.evidence}`);
            if (tp.why_it_matters) sections.push(`  - 意义：${tp.why_it_matters}`);
          } else {
            sections.push(`- ${String(tp)}`);
          }
        }
      }
      if (Array.isArray(o.key_takeaways)) {
        sections.push("");
        sections.push("### 核心收获");
        for (const k of o.key_takeaways as string[]) sections.push(`- ${k}`);
      }
      if (Array.isArray(o.misconceptions) && o.misconceptions.length > 0) {
        sections.push("");
        sections.push("### 误区与隐藏假设");
        for (const m of o.misconceptions as Array<Record<string, string>>) {
          const typeLabel = m.type === "misconception" ? "误区" : m.type === "hidden_assumption" ? "隐藏假设" : "探索性思考";
          let line = `- **[${typeLabel}]** ${m.item ?? ""}`;
          if (m.evidence) line += ` | 证据：${m.evidence}`;
          if (m.correction) line += ` | 纠正：${m.correction}`;
          sections.push(line);
        }
      }
    } else if (step.agent === "depth_evaluation") {
      const o = step.output;
      sections.push(`**深度评分**：${o.depth_score ?? "—"}/10`);
      const dims = o.dimensions as Record<string, { score: number; evidence: string; uncertainty: string }> | undefined;
      if (dims) {
        const DIMENSION_LABELS: Array<{ key: string; label: string }> = [
          { key: "judgment_shift", label: "判断力修正" },
          { key: "boundary_clarity", label: "边界清晰度" },
          { key: "transferability", label: "可迁移性" },
          { key: "hidden_assumption", label: "隐藏假设" },
          { key: "counterexample_awareness", label: "反例意识" },
          { key: "framework_formation", label: "框架形成" },
          { key: "behavior_impact", label: "行为影响" },
        ];
        sections.push("");
        sections.push("### 维度评分");
        sections.push("");
        sections.push("| 维度 | 分数 | 不确定性 | 证据 |");
        sections.push("|------|------|----------|------|");
        for (const { key, label } of DIMENSION_LABELS) {
          const dim = dims[key];
          if (!dim) continue;
          const uncertaintyLabel = dim.uncertainty === "low" ? "低" : dim.uncertainty === "high" ? "高" : "中";
          sections.push(`| ${label} | ${dim.score}/10 | ${uncertaintyLabel} | ${dim.evidence} |`);
        }
      }
      if (Array.isArray(o.blind_spots)) {
        sections.push("");
        sections.push("### 盲点");
        for (const b of o.blind_spots as string[]) sections.push(`- ${b}`);
      }
      if (Array.isArray(o.improvement_directions)) {
        sections.push("");
        sections.push("### 改进方向");
        for (const i of o.improvement_directions as string[]) sections.push(`- ${i}`);
      }
    } else if (step.agent === "asset") {
      const o = step.output;
      sections.push(`**是否值得提取资产**：${o.has_asset ? "是" : "否"}`);
      if (o.has_asset) {
        sections.push(`**资产类型**：${(o.asset_type ? ASSET_TYPE_MAP[o.asset_type as string] ?? o.asset_type : "—")}`);
        sections.push(`**标题**：${o.title ?? "—"}`);
        sections.push(`**核心洞察**：${o.core_insight ?? "—"}`);
        sections.push(`**可迁移价值**：${o.transferable_value ?? "—"}`);
        if (Array.isArray(curatorConnections) && curatorConnections.length > 0) {
          sections.push("");
          sections.push("### AI 建议连接");
          const layer = curatorConnectionsToConnectionLayer(
            curatorConnections as Array<Record<string, string>>,
          );
          if (layer.related_concepts.length > 0) sections.push(`**相关概念**：${layer.related_concepts.join("、")}`);
          if (layer.mental_models.length > 0) sections.push(`**心智模型**：${layer.mental_models.join("、")}`);
          if (layer.prior_experience.length > 0) sections.push(`**先前经验**：${layer.prior_experience.join("、")}`);
          if (layer.opposite_cases.length > 0) sections.push(`**对立案例**：${layer.opposite_cases.join("、")}`);
          if (layer.application_scenarios.length > 0) sections.push(`**应用场景**：${layer.application_scenarios.join("、")}`);
          if (layer.open_questions.length > 0) sections.push(`**开放问题**：${layer.open_questions.join("、")}`);
          if (layer.related_assets.length > 0) sections.push(`**相关资产**：${layer.related_assets.join("、")}`);
        }
      }
    } else if (step.agent === "curator") {
      const o = step.output;
      if (Array.isArray(o.connections)) {
        sections.push("### 关联建议");
        for (const c of o.connections as Array<Record<string, string>>) {
          sections.push(`- ${c.source_concept ?? ""} → ${c.target_concept ?? ""}（${c.connection_type ?? ""}）`);
        }
      }
      if (Array.isArray(o.organization_tips)) {
        sections.push("");
        sections.push("### 整理建议");
        for (const t of o.organization_tips as string[]) sections.push(`- ${t}`);
      }
    } else if (step.agent === "reflection") {
      const o = step.output;
      if (Array.isArray(o.reflection_questions)) {
        sections.push("### 反思问题");
        for (const q of o.reflection_questions as string[]) sections.push(`- ${q}`);
      }
      if (Array.isArray(o.action_items)) {
        sections.push("");
        sections.push("### 行动建议");
        for (const a of o.action_items as string[]) sections.push(`- ${a}`);
      }
    }

    sections.push("");
  }

  if (steps.length > 0) {
    const supervisorStep = steps.find((s) => s.agent === "supervisor" && s.status === "success");
    const successfulAgents = steps
      .filter((s) => s.status === "success" && s.agent !== "supervisor")
      .map((s) => s.agent);
    const failedErrors = steps
      .filter((s) => s.status === "failed" && s.error)
      .map((s) => s.error as string);
    const preferenceRules = extractPreferenceRules(steps);

    sections.push("## Trace Summary（轨迹摘要）");
    sections.push("");
    sections.push(`**是否识别到任务**：是`);
    sections.push(`**分析路径**：${successfulAgents.join(" → ") || "—"}`);
    sections.push(`**关键证据**：${(supervisorStep?.output?.reasoning as string) ?? "—"}`);
    sections.push(`**策略检查**：${preferenceRules.length > 0 ? `已应用 ${preferenceRules.length} 条偏好规则` : "无偏好规则"}`);
    sections.push(`**不确定性**：${failedErrors.length > 0 ? failedErrors.join("；") : "—"}`);
    sections.push("");
  }

  return sections.join("\n");
}
