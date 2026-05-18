import { readFile } from "node:fs/promises";
import path from "node:path";

export const OFFLINE_MISSION_ANALYSIS_PROMPT_VERSION =
  "offline-mission-analysis-v0.3-json-only";

const PROMPT_FILE_NAME = "offline-mission-analysis-v0.3-json-only.md";

export class PromptReadError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PromptReadError";
    this.cause = cause;
  }
}

export function getOfflineMissionAnalysisPromptPath() {
  return path.join(process.cwd(), "prompts", PROMPT_FILE_NAME);
}

export async function readPromptFile(promptPath: string) {
  try {
    const prompt = await readFile(promptPath, "utf8");

    if (prompt.trim().length === 0) {
      throw new PromptReadError(`Prompt 文件为空：${promptPath}`);
    }

    return prompt;
  } catch (error) {
    if (error instanceof PromptReadError) {
      throw error;
    }

    throw new PromptReadError(`无法读取 Prompt 文件：${promptPath}`, error);
  }
}

export async function readOfflineMissionAnalysisPrompt() {
  return readPromptFile(getOfflineMissionAnalysisPromptPath());
}
