import type { AgentContext, AgentStep, AgentType } from "./agent-types";
import { supervisorAgent, createStep, completeStep, failStep } from "./supervisor-agent";
import { reviewAgent } from "./review-agent";
import { depthEvaluationAgent } from "./depth-evaluation-agent";
import { assetAgent } from "./asset-agent";
import { curatorAgent } from "./curator-agent";
import { reflectionAgent } from "./reflection-agent";

const agentRegistry: Record<AgentType, typeof supervisorAgent> = {
  supervisor: supervisorAgent,
  review: reviewAgent,
  depth_evaluation: depthEvaluationAgent,
  asset: assetAgent,
  curator: curatorAgent,
  reflection: reflectionAgent,
};

export async function runAgentPipeline(
  input: AgentContext["input"],
): Promise<{ steps: AgentStep[]; supervisorDecision: string }> {
  const steps: AgentStep[] = [];
  const context: AgentContext = { input, previousSteps: steps };

  const supervisorStep = createStep(supervisorAgent, { input });
  steps.push(supervisorStep);

  let supervisorOutput: Record<string, unknown>;
  try {
    supervisorOutput = await supervisorAgent.execute(context);
    steps[0] = completeStep(steps[0], supervisorOutput);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Supervisor failed";
    console.error("[AgentPipeline] Supervisor failed:", errMsg);
    steps[0] = failStep(steps[0], errMsg);
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

  for (const stepType of plannedSteps) {
    if (stepType === "supervisor") continue;

    const agent = agentRegistry[stepType as AgentType];
    if (!agent) continue;

    const stepInput: Record<string, unknown> = { input };
    const step = createStep(agent, stepInput);
    steps.push(step);

    try {
      const output = await agent.execute({ input, previousSteps: steps });
      steps[steps.length - 1] = completeStep(steps[steps.length - 1], output);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : `${stepType} agent failed`;
      console.error(`[AgentPipeline] Agent "${stepType}" failed:`, errMsg);
      steps[steps.length - 1] = failStep(
        steps[steps.length - 1],
        errMsg,
      );
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
    if (typeof a.asset_type === "string") draftAsset.type = a.asset_type;

    result.asset_decision = {
      asset_candidate: a.has_asset === true,
      recommended_asset_type: a.asset_type ?? "",
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
        sections.push("### 转折点");
        for (const t of o.turning_points as string[]) sections.push(`- ${t}`);
      }
      if (Array.isArray(o.key_takeaways)) {
        sections.push("");
        sections.push("### 核心收获");
        for (const k of o.key_takeaways as string[]) sections.push(`- ${k}`);
      }
    } else if (step.agent === "depth_evaluation") {
      const o = step.output;
      sections.push(`**深度评分**：${o.depth_score ?? "—"}/10`);
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
        sections.push(`**资产类型**：${o.asset_type ?? "—"}`);
        sections.push(`**标题**：${o.title ?? "—"}`);
        sections.push(`**核心洞察**：${o.core_insight ?? "—"}`);
        sections.push(`**可迁移价值**：${o.transferable_value ?? "—"}`);
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
