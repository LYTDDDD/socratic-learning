export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

export function typeBadgeColor(type: string): string {
  switch (type) {
    case "MethodCard":
      return "bg-blue/10 text-blue";
    case "MisconceptionCard":
      return "bg-red/10 text-red";
    case "ReflectionCard":
      return "bg-surface-2 text-ink-muted";
    case "ConceptCard":
      return "bg-green/10 text-green";
    case "CaseCard":
      return "bg-amber/10 text-amber";
    default:
      return "bg-surface-2 text-ink-muted";
  }
}

export function maturityBadge(maturity: string): string {
  if (maturity === "Ability") return "bg-green/10 text-green";
  if (maturity === "Understanding") return "bg-blue/10 text-blue";
  return "bg-surface-2 text-ink-muted";
}

export function statusBadge(status: string): string {
  if (status === "confirmed") return "bg-green/10 text-green";
  return "bg-amber/10 text-amber";
}

export function resultBadgeColor(result: string): string {
  if (result === "good") return "bg-green/15 text-green";
  if (result === "partial") return "bg-amber/10 text-amber";
  return "bg-amber/10 text-amber";
}

export function resultLabel(result: string): string {
  if (result === "good") return "理解到位";
  if (result === "partial") return "部分理解";
  return "需要补充";
}

export function feedbackSurfaceColor(evaluation: string): string {
  if (evaluation === "good") return "border-green/30 bg-green/5";
  if (evaluation === "partial") return "border-amber/30 bg-amber/5";
  return "border-amber/20 bg-amber/5";
}

export function feedbackMarkerBadge(evaluation: string): string {
  if (evaluation === "good") return "bg-green/10 text-green";
  if (evaluation === "partial") return "bg-amber/10 text-amber";
  return "bg-amber/5 text-amber";
}

export function feedbackMarkerLabel(evaluation: string): string {
  if (evaluation === "good") return "✓";
  if (evaluation === "partial") return "◐";
  return "✗";
}
