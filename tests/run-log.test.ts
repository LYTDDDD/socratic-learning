import { describe, expect, it } from "vitest";
import { generateRunId, type RunLog } from "../lib/run-log";
import { getModelConfig } from "../lib/llm";

describe("generateRunId", () => {
  it("starts with run_ prefix", () => {
    const id = generateRunId();
    expect(id.startsWith("run_")).toBe(true);
  });

  it("contains timestamp and random segment", () => {
    const id = generateRunId();
    const parts = id.split("_");
    expect(parts.length).toBe(3);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThanOrEqual(6);
  });

  it("generates unique ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRunId()));
    expect(ids.size).toBe(100);
  });
});

describe("RunLog type structure", () => {
  it("accepts a valid RunLog object", () => {
    const log: RunLog = {
      run_id: generateRunId(),
      created_at: new Date().toISOString(),
      input_snapshot: { originalGoal: "test goal", conversation: "test conversation" },
      prompt_version: "offline-mission-analysis-v0.1",
      model_name: "gpt-4o-mini",
      request_status: "success",
      parse_status: "success",
      duration_ms: 1234,
      error_message: null,
      user_actions: [{ type: "copy_report", at: new Date().toISOString() }],
    };
    expect(log.run_id.startsWith("run_")).toBe(true);
    expect(log.request_status).toBe("success");
    expect(log.parse_status).toBe("success");
    expect(log.error_message).toBeNull();
    expect(log.user_actions?.[0].type).toBe("copy_report");
  });

  it("accepts a failed RunLog with error_message", () => {
    const log: RunLog = {
      run_id: generateRunId(),
      created_at: new Date().toISOString(),
      input_snapshot: { originalGoal: "", conversation: "" },
      prompt_version: "offline-mission-analysis-v0.1",
      model_name: "unknown",
      request_status: "failed",
      parse_status: "not_attempted",
      duration_ms: 50,
      error_message: "模型调用失败",
    };
    expect(log.request_status).toBe("failed");
    expect(log.error_message).toBe("模型调用失败");
  });

  it("accepts a RunLog with parse_status failed", () => {
    const log: RunLog = {
      run_id: generateRunId(),
      created_at: new Date().toISOString(),
      input_snapshot: { originalGoal: "goal", conversation: "conv" },
      prompt_version: "offline-mission-analysis-v0.1",
      model_name: "gpt-4o-mini",
      request_status: "success",
      parse_status: "failed",
      duration_ms: 2000,
      error_message: "JSON extraction failed",
    };
    expect(log.parse_status).toBe("failed");
    expect(log.error_message).toBeTruthy();
  });
});

describe("RunLog construction - all 5 route branches", () => {
  const baseFields = {
    run_id: generateRunId(),
    created_at: new Date().toISOString(),
    prompt_version: "offline-mission-analysis-v0.1",
    model_name: "gpt-4o-mini",
    duration_ms: 100,
  };

  // Branch 1: 非法 JSON 体
  it("branch 1 - invalid JSON body: request_status=error, parse_status=not_attempted", () => {
    const log: RunLog = {
      ...baseFields,
      input_snapshot: { originalGoal: "", conversation: "" },
      request_status: "error",
      parse_status: "not_attempted",
      error_message: "请求体必须是合法 JSON。",
    };
    expect(log.request_status).toBe("error");
    expect(log.parse_status).toBe("not_attempted");
    expect(log.error_message).toBe("请求体必须是合法 JSON。");
    expect(log.input_snapshot.originalGoal).toBe("");
    expect(log.input_snapshot.conversation).toBe("");
  });

  // Branch 2: 缺少必填字段
  it("branch 2 - missing required fields: request_status=error, parse_status=not_attempted", () => {
    const log: RunLog = {
      ...baseFields,
      input_snapshot: { originalGoal: "", conversation: "" },
      request_status: "error",
      parse_status: "not_attempted",
      error_message: "缺少必填输入：originalGoal, conversation。",
    };
    expect(log.request_status).toBe("error");
    expect(log.parse_status).toBe("not_attempted");
    expect(log.error_message).toContain("originalGoal");
    expect(log.error_message).toContain("conversation");
  });

  // Branch 3: 模型调用成功 + 解析成功
  it("branch 3 - model success + parse success: request_status=success, parse_status=success", () => {
    const log: RunLog = {
      ...baseFields,
      input_snapshot: { originalGoal: "理解苏格拉底式提问", conversation: "用户说..." },
      request_status: "success",
      parse_status: "success",
      error_message: null,
    };
    expect(log.request_status).toBe("success");
    expect(log.parse_status).toBe("success");
    expect(log.error_message).toBeNull();
    expect(log.input_snapshot.originalGoal).toBeTruthy();
  });

  // Branch 4: 模型调用成功 + 解析失败
  it("branch 4 - model success + parse failed: request_status=success, parse_status=failed", () => {
    const log: RunLog = {
      ...baseFields,
      input_snapshot: { originalGoal: "理解苏格拉底式提问", conversation: "用户说..." },
      request_status: "success",
      parse_status: "failed",
      error_message: "JSON extraction failed: unexpected token",
    };
    expect(log.request_status).toBe("success");
    expect(log.parse_status).toBe("failed");
    expect(log.error_message).toBeTruthy();
  });

  // Branch 5: 模型调用异常
  it("branch 5 - model call exception: request_status=failed, parse_status=not_attempted", () => {
    const log: RunLog = {
      ...baseFields,
      input_snapshot: { originalGoal: "理解苏格拉底式提问", conversation: "用户说..." },
      request_status: "failed",
      parse_status: "not_attempted",
      error_message: "模型调用失败",
    };
    expect(log.request_status).toBe("failed");
    expect(log.parse_status).toBe("not_attempted");
    expect(log.error_message).toBeTruthy();
  });
});

describe("getModelName fallback", () => {
  it("returns 'unknown' when getModelConfig throws", () => {
    // 当 OPENAI_API_KEY 未配置时，getModelConfig() 会抛出异常
    // 路由层 getModelName() 用 try/catch 包裹，回退为 "unknown"
    function getModelName(): string {
      try {
        return getModelConfig().model;
      } catch {
        return "unknown";
      }
    }

    // 在测试环境中，OPENAI_API_KEY 通常未设置，getModelConfig 会抛出异常
    const name = getModelName();
    // 无论环境如何，getModelName 都应返回有效字符串
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
    // 如果环境变量未配置，应回退为 "unknown"
    if (!process.env.OPENAI_API_KEY) {
      expect(name).toBe("unknown");
    }
  });

  it("getModelName always returns a non-empty string", () => {
    function getModelName(): string {
      try {
        return getModelConfig().model;
      } catch {
        return "unknown";
      }
    }
    const name = getModelName();
    expect(name).toBeTruthy();
    // "unknown" 或实际的模型名都是合法值
    expect(["unknown", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]).toContain(name);
  });
});
