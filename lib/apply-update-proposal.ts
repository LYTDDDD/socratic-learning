import { loadAssets, createAssetVersion } from "./asset-store";
import type { CognitiveAsset } from "./extract-asset";

type UpdateProposal = {
  suggested_action: string;
  related_asset_id: string;
  related_asset_title: string;
  reason: string;
  evidence: string | string[];
  suggested_changes?: Record<string, unknown>;
};

type ApplyResult =
  | { success: true; asset: CognitiveAsset }
  | { success: false; error: string };

const ALLOWED_ACTIONS = new Set(["minor_edit", "create_new_version"]);

function proposalToAssetUpdates(proposal: UpdateProposal): Partial<CognitiveAsset> {
  const changes = proposal.suggested_changes ?? {};
  return {
    title: typeof changes.title === "string" ? changes.title : undefined,
    core_insight: typeof changes.core_insight === "string" ? changes.core_insight : undefined,
    original_judgment: typeof changes.original_judgment === "string" ? changes.original_judgment : undefined,
    revised_judgment: typeof changes.revised_judgment === "string" ? changes.revised_judgment : undefined,
    my_understanding: typeof changes.my_understanding === "string" ? changes.my_understanding : undefined,
    transferable_value: typeof changes.transferable_value === "string" ? changes.transferable_value : undefined,
  };
}

export function applyAssetUpdateProposal(proposal: UpdateProposal): ApplyResult {
  const assetId = proposal.related_asset_id?.trim();
  if (!assetId) {
    return { success: false, error: "提案中缺少关联资产 ID" };
  }

  const action = proposal.suggested_action?.trim();
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return { success: false, error: `不支持的动作类型「${action || "(空)"}」，仅支持 minor_edit 和 create_new_version` };
  }

  const assets = loadAssets();
  const target = assets.find((a) => a.asset_id === assetId);

  if (!target) {
    return { success: false, error: `未找到关联资产「${proposal.related_asset_title || assetId}」` };
  }

  const updates = proposalToAssetUpdates(proposal);
  const hasUpdates = Object.values(updates).some((v) => v !== undefined);

  if (!hasUpdates) {
    return { success: false, error: "提案中没有可应用的变更字段" };
  }

  const changeReason = proposal.reason
    ? `[${action}] ${proposal.reason}`
    : `通过资产更新建议应用（${action}）`;

  const updated = createAssetVersion(target, updates, changeReason);
  return { success: true, asset: updated };
}

export function findAssetById(assetId: string): CognitiveAsset | undefined {
  if (!assetId.trim()) return undefined;
  const assets = loadAssets();
  return assets.find((a) => a.asset_id === assetId);
}

export type { UpdateProposal, ApplyResult };
