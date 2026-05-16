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
      return "bg-blue-100 text-blue-800";
    case "MisconceptionCard":
      return "bg-red-100 text-red-800";
    case "ReflectionCard":
      return "bg-purple-100 text-purple-800";
    case "ConceptCard":
      return "bg-green-100 text-green-800";
    case "CaseCard":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function maturityBadge(maturity: string): string {
  if (maturity === "Ability") return "bg-emerald-100 text-emerald-800";
  if (maturity === "Understanding") return "bg-sky-100 text-sky-800";
  return "bg-stone-100 text-stone-800";
}

export function statusBadge(status: string): string {
  if (status === "confirmed") return "bg-green-100 text-green-800";
  return "bg-yellow-100 text-yellow-800";
}

export function resultBadgeColor(result: string): string {
  if (result === "good") return "bg-moss/15 text-moss";
  if (result === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-rust/10 text-rust";
}

export function resultLabel(result: string): string {
  if (result === "good") return "理解到位";
  if (result === "partial") return "部分理解";
  return "需要补充";
}
