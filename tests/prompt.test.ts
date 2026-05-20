import { describe, expect, it } from "vitest";
import { readOfflineMissionAnalysisPrompt } from "../lib/prompt";

describe("offline mission analysis prompt", () => {
  it("uses AI-suggested connections instead of user-built or legacy connection fields", async () => {
    const prompt = await readOfflineMissionAnalysisPrompt();

    expect(prompt).toContain("ai_suggested_connections");
    expect(prompt).toContain("不要输出 user_built_connections");
    expect(prompt).not.toContain("\"connection_layer\"");
    expect(prompt).not.toContain("prior_experience_prompts");
  });
});
