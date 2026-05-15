import type { AgentDefinition, AgentContext, AgentStep } from "./agent-types";
import { callReviewModel } from "./llm";

const SUPERVISOR_SYSTEM_PROMPT = `你是一个分析流程编排器（SupervisorAgent）。你的职责是根据用户输入决定分析流程中哪些步骤需要执行。

可选的分析步骤：
1. review — 对话复盘：总结对话中的关键决策、转折点和收获
2. depth_evaluation — 深度评估：评估认知深度、盲点和改进方向
3. asset — 资产决策：判断是否值得提取认知资产，如果值得则提取
4. curator — 整理建议：给出知识整理和关联建议
5. reflection — 反思建议：给出个人反思和行动建议

请根据输入内容，输出一个 JSON 对象，格式如下：
{
  "steps": ["review", "depth_evaluation", "asset", "curator", "reflection"],
  "reasoning": "简要说明为什么选择这些步骤"
}

规则：
- steps 数组中的步骤按执行顺序排列
- 至少包含 review 和 asset 两个步骤
- 如果对话内容较短或较浅，可以跳过 depth_evaluation
- 如果对话内容不涉及知识整理，可以跳过 curator
- 如果对话内容不涉及个人反思，可以跳过 reflection
- 只输出 JSON，不要输出其他内容`;

export const supervisorAgent: AgentDefinition = {
  type: "supervisor",
  name: "SupervisorAgent",
  description: "编排分析流程，决定执行哪些步骤",
  async execute(context: AgentContext): Promise<Record<string, unknown>> {
    const userPrompt = [
      `Background: ${context.input.background}`,
      `Original Goal: ${context.input.originalGoal}`,
      `Conversation (first 4000 chars): ${context.input.conversation.slice(0, 4000)}`,
      `Notes: ${context.input.notes}`,
      `Expected Output: ${context.input.expectedOutput}`,
    ].join("\n\n");

    const raw = await callReviewModel(SUPERVISOR_SYSTEM_PROMPT, userPrompt);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          steps: ["review", "depth_evaluation", "asset", "curator", "reflection"],
          reasoning: "无法解析 Supervisor 输出，使用默认全步骤流程",
        };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        steps: Array.isArray(parsed.steps) ? parsed.steps : ["review", "asset"],
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      };
    } catch {
      return {
        steps: ["review", "depth_evaluation", "asset", "curator", "reflection"],
        reasoning: "Supervisor 输出解析失败，使用默认全步骤流程",
      };
    }
  },
};

export function createStep(
  agent: AgentDefinition,
  input: Record<string, unknown>,
): AgentStep {
  return {
    agent: agent.type,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    input,
    output: null,
    status: "running",
    error: null,
  };
}

export function completeStep(
  step: AgentStep,
  output: Record<string, unknown>,
): AgentStep {
  return {
    ...step,
    finishedAt: new Date().toISOString(),
    output,
    status: "success",
  };
}

export function failStep(step: AgentStep, error: string): AgentStep {
  return {
    ...step,
    finishedAt: new Date().toISOString(),
    status: "failed",
    error,
  };
}
