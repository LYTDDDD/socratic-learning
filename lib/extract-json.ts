import type { ExtractJsonResult } from "./analyze-types";

function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function repairSingleQuotes(text: string): string {
  let result = "";
  let inString = false;
  let stringChar = "";
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (!inString) {
      if (ch === "'" || ch === '"') {
        inString = true;
        stringChar = ch;
        result += '"';
      } else {
        result += ch;
      }
    } else {
      if (ch === "\\") {
        result += ch;
        i++;
        if (i < text.length) {
          result += text[i];
        }
      } else if (ch === stringChar) {
        inString = false;
        result += '"';
      } else if (ch === '"') {
        result += '\\"';
      } else {
        result += ch;
      }
    }

    i++;
  }

  return result;
}

function replaceChineseQuotesSimple(text: string): string {
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function repairChineseQuotes(text: string): string {
  let result = "";
  let inString = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        result += ch;
      } else if (ch === "\u201c") {
        inString = true;
        result += '"';
      } else if (ch === "\u201d") {
        result += '"';
      } else if (ch === "\u2018" || ch === "\u2019") {
        result += "'";
      } else {
        result += ch;
      }
    } else {
      if (ch === "\\") {
        result += ch;
        i++;
        if (i < text.length) {
          result += text[i];
        }
      } else if (ch === '"') {
        inString = false;
        result += ch;
      } else if (ch === "\u201c" || ch === "\u201d") {
        result += '\\"';
      } else if (ch === "\u2018" || ch === "\u2019") {
        result += "'";
      } else {
        result += ch;
      }
    }

    i++;
  }

  return result;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const repairs: ((t: string) => string)[] = [
    (t) => t,
    removeTrailingCommas,
    replaceChineseQuotesSimple,
    (t) => removeTrailingCommas(replaceChineseQuotesSimple(t)),
    repairChineseQuotes,
    (t) => removeTrailingCommas(repairChineseQuotes(t)),
    repairSingleQuotes,
    (t) => removeTrailingCommas(repairSingleQuotes(t)),
    (t) => replaceChineseQuotesSimple(repairSingleQuotes(t)),
    (t) => removeTrailingCommas(replaceChineseQuotesSimple(repairSingleQuotes(t))),
    (t) => repairChineseQuotes(repairSingleQuotes(t)),
    (t) => removeTrailingCommas(repairChineseQuotes(repairSingleQuotes(t))),
  ];

  for (const repair of repairs) {
    try {
      const repaired = repair(text);
      const parsed = JSON.parse(repaired);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function looksLikeJsonObject(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("\u201c");
}

export function extractJsonFromOutput(rawOutput: string): ExtractJsonResult {
  if (!rawOutput || typeof rawOutput !== "string") {
    return { success: false, error: "rawOutput 为空或非字符串。" };
  }

  const jsonBlockPatterns = [
    /```json\s*\n?([\s\S]*?)\n```/g,
    /```json\s+([\s\S]*?)\n```/g,
  ];

  for (const pattern of jsonBlockPatterns) {
    const matches = [...rawOutput.matchAll(pattern)];

    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const jsonText = match[1].trim();

      if (!looksLikeJsonObject(jsonText)) {
        continue;
      }

      const parsed = tryParseJson(jsonText);

      if (parsed && (parsed.mission_review || parsed.depth_evaluation || parsed.asset_decision || parsed.trace_summary)) {
        const before = rawOutput.substring(0, match.index);
        const after = rawOutput.substring(match.index + match[0].length);
        const markdown = (before + after).replace(/\n{3,}/g, "\n\n").trim();
        return { success: true, json: parsed, markdown };
      }
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const jsonText = match[1].trim();

      if (!looksLikeJsonObject(jsonText)) {
        continue;
      }

      const parsed = tryParseJson(jsonText);

      if (parsed) {
        const before = rawOutput.substring(0, match.index);
        const after = rawOutput.substring(match.index + match[0].length);
        const markdown = (before + after).replace(/\n{3,}/g, "\n\n").trim();
        return { success: true, json: parsed, markdown };
      }
    }
  }

  const plainBlockPattern = /```\s*\n([\s\S]*?)\n```/g;
  const plainMatches = [...rawOutput.matchAll(plainBlockPattern)];

  for (let i = plainMatches.length - 1; i >= 0; i--) {
    const match = plainMatches[i];
    const jsonText = match[1].trim();

    if (!looksLikeJsonObject(jsonText)) {
      continue;
    }

    const parsed = tryParseJson(jsonText);

    if (parsed) {
      const before = rawOutput.substring(0, match.index);
      const after = rawOutput.substring(match.index + match[0].length);
      const markdown = (before + after).replace(/\n{3,}/g, "\n\n").trim();
      return { success: true, json: parsed, markdown };
    }
  }

  const extracted = extractBareJsonObject(rawOutput);
  if (extracted) {
    return extracted;
  }

  return { success: false, error: "未找到可解析的 JSON 内容。" };
}

function extractBareJsonObject(text: string): ExtractJsonResult | null {
  let depth = 0;
  let start = -1;

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "}") {
      depth++;
    } else if (text[i] === "{") {
      depth--;
      if (depth === 0) {
        start = i;
        const candidate = text.substring(start);

        const parsed = tryParseJson(candidate);

        if (parsed) {
          const markdown = text.substring(0, start).replace(/\n{3,}/g, "\n\n").trim();
          return { success: true, json: parsed, markdown };
        }

        depth = 0;
        start = -1;
      }
    }
  }

  return null;
}
