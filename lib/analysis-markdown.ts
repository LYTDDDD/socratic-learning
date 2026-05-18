function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function line(label: string, value: unknown): string {
  const text = asString(value);
  return text ? `- ${label}: ${text}` : "";
}

function list(title: string, values: unknown): string {
  const items = asStringArray(values);
  if (items.length === 0) return "";
  return [`### ${title}`, ...items.map((item) => `- ${item}`)].join("\n");
}

function section(title: string, body: string[]): string {
  const content = body.filter(Boolean).join("\n\n").trim();
  return content ? `## ${title}\n\n${content}` : "";
}

export function buildMarkdownFromAnalysisJson(json: unknown): string | null {
  if (!isRecord(json)) return null;

  const missionReview = asRecord(json.mission_review);
  const depthEvaluation = asRecord(json.depth_evaluation);
  const assetDecision = asRecord(json.asset_decision);
  const traceSummary = asRecord(json.trace_summary);
  const candidatePackage = asRecord(assetDecision.asset_candidate_package);
  const draftAsset = asRecord(candidatePackage.draft_asset);

  const turningPoints = Array.isArray(missionReview.key_turning_points)
    ? missionReview.key_turning_points
        .filter(isRecord)
        .map((item) =>
          [
            `- ${asString(item.turning_point) || "未命名转折点"}`,
            line("证据", item.evidence),
            line("意义", item.why_it_matters),
          ].filter(Boolean).join("\n"),
        )
    : [];

  const dimensionScores = asRecord(depthEvaluation.dimension_scores);
  const scoreLines = Object.entries(dimensionScores).map(([key, value]) => {
    const score = asRecord(value);
    const evidence = asString(score.evidence);
    const uncertainty = asString(score.uncertainty);
    return [
      `- ${key}: ${asString(score.score) || "0"}`,
      evidence ? `  - 证据: ${evidence}` : "",
      uncertainty ? `  - 不确定性: ${uncertainty}` : "",
    ].filter(Boolean).join("\n");
  });

  const assetLines = [
    line("是否进入候选", assetDecision.asset_candidate),
    line("推荐类型", assetDecision.recommended_asset_type),
    line("推荐成熟度", assetDecision.recommended_maturity),
    line("保存理由", assetDecision.why_worth_saving),
    draftAsset.title ? `### Draft Asset\n\n${[
      line("标题", draftAsset.title),
      line("核心洞察", draftAsset.core_insight),
      line("AI 摘要", draftAsset.ai_generated_summary),
      line("理解提示", draftAsset.my_understanding_prompt),
      line("解决的问题", draftAsset.problem_it_solves),
      line("原始判断", draftAsset.original_judgment),
      line("修正后判断", draftAsset.revised_judgment),
      line("可迁移价值", draftAsset.transferable_value),
    ].filter(Boolean).join("\n")}` : "",
    list("复习问题", draftAsset.review_questions),
    list("连接问题", draftAsset.connection_questions),
    list("应用问题", draftAsset.application_questions),
  ];

  const markdown = [
    "# Offline Mission Analysis",
    section("Mission Review", [
      line("原始目标", missionReview.original_goal),
      line("最终判断", missionReview.final_judgment),
      turningPoints.length > 0 ? `### 关键转折\n${turningPoints.join("\n")}` : "",
      line("下一步行动", asRecord(missionReview.next_action).action),
    ]),
    section("Depth Evaluation", [
      line("总分", depthEvaluation.overall_depth_score),
      line("理由", depthEvaluation.overall_reason),
      scoreLines.length > 0 ? `### 维度评分\n${scoreLines.join("\n")}` : "",
    ]),
    section("Asset Decision", assetLines),
    section("Trace Summary", [
      line("识别到任务", traceSummary.mission_detected),
      list("分析路径", traceSummary.analysis_path),
      list("关键证据", traceSummary.key_evidence_used),
      list("策略检查", traceSummary.policy_checks),
      list("不确定性", traceSummary.uncertainties),
    ]),
  ].filter(Boolean).join("\n\n");

  return markdown.trim() ? markdown : null;
}
