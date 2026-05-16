import https from "node:https";
import type { AnalyzeInput } from "./analyze-types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    text?: string | null;
  }>;
  error?: {
    message?: string;
  };
};

export class ModelCallError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModelCallError";
    this.status = status;
  }
}

const MODEL_TIMEOUT_MS = 300_000;

export function getModelConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new ModelCallError("缺少 OPENAI_API_KEY，请在 .env.local 中配置。");
  }

  if (!baseUrl) {
    throw new ModelCallError("缺少 OPENAI_BASE_URL，请在 .env.local 中配置。");
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
  };
}

function buildUserContent(input: AnalyzeInput) {
  const sections = [
    "请分析以下半结构化输入：",
    "",
    "## Background（背景）",
    input.background,
    "",
    "## Original Goal（原始目标）",
    input.originalGoal,
    "",
    "## Conversation（对话内容）",
    input.conversation,
    "",
    "## Notes（备注）",
    input.notes,
    "",
    "## Expected Output（期望输出）",
    input.expectedOutput,
  ];

  if (input.preferenceRules && input.preferenceRules.length > 0) {
    sections.push(
      "",
      "## User Preference Rules（用户偏好规则）",
      "以下是用户已确认的偏好规则，请在分析时参考这些规则：",
      "",
      ...input.preferenceRules.map((rule, i) => `${i + 1}. ${rule}`),
    );
  }

  return sections.join("\n");
}

export async function callAnalysisModel(prompt: string, input: AnalyzeInput, signal?: AbortSignal) {
  const { apiKey, baseUrl, model } = getModelConfig();
  const requestBody = JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: buildUserContent(input),
      },
    ],
    temperature: 0.2,
  });
  const response = await requestModel(baseUrl, apiKey, requestBody, signal);

  let data: ChatCompletionResponse;

  try {
    data = JSON.parse(response.body) as ChatCompletionResponse;
  } catch {
    throw new ModelCallError("模型接口返回了无法解析的响应。", response.status);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new ModelCallError(
      `模型调用失败，HTTP 状态码：${response.status}。`,
      response.status,
    );
  }

  const rawOutput = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;

  if (!rawOutput) {
    throw new ModelCallError("模型接口未返回可用文本。", response.status);
  }

  return rawOutput;
}

export async function callReviewModel(systemPrompt: string, userPrompt: string, signal?: AbortSignal) {
  const { apiKey, baseUrl, model } = getModelConfig();
  const requestBody = JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.3,
  });
  const response = await requestModel(baseUrl, apiKey, requestBody, signal);

  let data: ChatCompletionResponse;

  try {
    data = JSON.parse(response.body) as ChatCompletionResponse;
  } catch {
    throw new ModelCallError("模型接口返回了无法解析的响应。", response.status);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new ModelCallError(
      `模型调用失败，HTTP 状态码：${response.status}。`,
      response.status,
    );
  }

  const rawOutput = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;

  if (!rawOutput) {
    throw new ModelCallError("模型接口未返回可用文本。", response.status);
  }

  return rawOutput;
}

function requestModel(baseUrl: string, apiKey: string, body: string, signal?: AbortSignal) {
  const url = new URL(`${baseUrl}/chat/completions`);

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    let aborted = false;
    const request = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "cognitive-asset-lab/0.1",
        },
        timeout: MODEL_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 500,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    if (signal) {
      if (signal.aborted) {
        aborted = true;
        request.destroy(new Error("Request aborted"));
        return reject(new Error("Request aborted"));
      }
      signal.addEventListener("abort", () => {
        aborted = true;
        request.destroy(new Error("Request aborted"));
        reject(new Error("Request aborted"));
      }, { once: true });
    }

    request.on("timeout", () => {
      request.destroy(new ModelCallError("模型调用超时。"));
    });

    request.on("error", (error) => {
      if (aborted) return;
      reject(
        error instanceof ModelCallError
          ? error
          : new ModelCallError("无法连接模型接口。"),
      );
    });

    request.write(body);
    request.end();
  });
}
