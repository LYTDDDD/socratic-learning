import type { CognitiveAsset } from "./extract-asset";

const STORAGE_KEY = "socratic-knowledge-subcards";

export type KnowledgeSubCard = {
  id: string;
  parentAssetId: string;
  title: string;
  markdownContent: string;
  corePoint?: string;
  example?: string;
  applicationScenario?: string;
  triggerSignal?: string;
  source: "user_created" | "ai_suggested_user_edited";
  status: "draft" | "saved" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSubCardDraft = Pick<
  KnowledgeSubCard,
  "parentAssetId" | "title" | "markdownContent" | "source"
> &
  Partial<Pick<KnowledgeSubCard, "corePoint" | "example" | "applicationScenario" | "triggerSignal">>;

export const KNOWLEDGE_SUBCARD_TEMPLATE = `# 子卡标题

## 核心观点
一句话说清楚这张子卡的判断。

## 1 个案例
用一个具体例子说明它。

## 1 个应用场景
下一次在什么场景中调用它？

## 触发信号（可选）
当我看到什么情况时，应该想起这张卡？
`;

function generateSubCardId(): string {
  return `subcard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadRawSubCards(): KnowledgeSubCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateSubCard).filter((card): card is KnowledgeSubCard => card !== null);
  } catch {
    return [];
  }
}

function migrateSubCard(value: unknown): KnowledgeSubCard | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const parentAssetId = typeof raw.parentAssetId === "string" ? raw.parentAssetId : "";
  if (!parentAssetId) return null;

  const now = new Date().toISOString();

  return {
    id: typeof raw.id === "string" ? raw.id : generateSubCardId(),
    parentAssetId,
    title: typeof raw.title === "string" ? raw.title : "未命名子卡",
    markdownContent: typeof raw.markdownContent === "string" ? raw.markdownContent : KNOWLEDGE_SUBCARD_TEMPLATE,
    corePoint: typeof raw.corePoint === "string" ? raw.corePoint : undefined,
    example: typeof raw.example === "string" ? raw.example : undefined,
    applicationScenario: typeof raw.applicationScenario === "string" ? raw.applicationScenario : undefined,
    triggerSignal: typeof raw.triggerSignal === "string" ? raw.triggerSignal : undefined,
    source: raw.source === "ai_suggested_user_edited" ? "ai_suggested_user_edited" : "user_created",
    status: raw.status === "draft" || raw.status === "archived" ? raw.status : "saved",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export function createKnowledgeSubCard(draft: KnowledgeSubCardDraft): KnowledgeSubCard {
  const now = new Date().toISOString();

  return {
    id: generateSubCardId(),
    parentAssetId: draft.parentAssetId,
    title: draft.title.trim() || "未命名子卡",
    markdownContent: draft.markdownContent.trim() || KNOWLEDGE_SUBCARD_TEMPLATE,
    corePoint: draft.corePoint,
    example: draft.example,
    applicationScenario: draft.applicationScenario,
    triggerSignal: draft.triggerSignal,
    source: draft.source,
    status: "saved",
    createdAt: now,
    updatedAt: now,
  };
}

export function saveKnowledgeSubCard(card: KnowledgeSubCard): void {
  try {
    const cards = loadRawSubCards();
    const next = [
      { ...card, updatedAt: new Date().toISOString(), status: "saved" as const },
      ...cards.filter((item) => item.id !== card.id),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function loadKnowledgeSubCards(parentAssetId?: string): KnowledgeSubCard[] {
  const cards = loadRawSubCards().filter((card) => card.status !== "archived");
  if (!parentAssetId) return cards;
  return cards.filter((card) => card.parentAssetId === parentAssetId);
}

export function archiveKnowledgeSubCard(cardId: string): void {
  try {
    const cards = loadRawSubCards();
    const next = cards.map((card) =>
      card.id === cardId
        ? { ...card, status: "archived" as const, updatedAt: new Date().toISOString() }
        : card
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function buildTemplateForAsset(asset: CognitiveAsset): string {
  return `# ${asset.title || "子卡标题"}

## 核心观点
${asset.core_insight || "一句话说清楚这张子卡的判断。"}

## 1 个案例
写一个你真实遇到或容易想象的具体例子。

## 1 个应用场景
${asset.application_questions[0] ?? "下一次在什么场景中调用它？"}

## 触发信号（可选）
当我看到什么情况时，应该想起这张卡？
`;
}

export function suggestSubCardDrafts(asset: CognitiveAsset): KnowledgeSubCardDraft[] {
  const ideas = [
    {
      title: asset.title ? `${asset.title}：核心调用` : "核心调用子卡",
      corePoint: asset.core_insight,
    },
    {
      title: "边界与反例",
      corePoint: asset.transferable_value,
    },
    {
      title: "下次使用场景",
      corePoint: asset.application_questions[0] ?? asset.user_built_connections.application_scenarios[0] ?? "",
    },
  ].filter((idea) => idea.corePoint && idea.corePoint.trim().length > 0);

  return ideas.slice(0, 5).map((idea) => ({
    parentAssetId: asset.asset_id,
    title: idea.title,
    markdownContent: `# ${idea.title}

## 核心观点
${idea.corePoint}

## 1 个案例
请改写成你自己的一个具体案例。

## 1 个应用场景
请补充一个你会真正调用它的场景。

## 触发信号（可选）
当我看到什么情况时，应该想起这张卡？
`,
    corePoint: idea.corePoint,
    source: "ai_suggested_user_edited",
  }));
}
