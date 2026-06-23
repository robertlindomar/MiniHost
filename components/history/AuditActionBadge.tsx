import { AlertCircle, Box, Layers, Minus, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import type { AuditActionCategory } from "@/lib/history";
import { getActionCategory, getActionLabel } from "@/lib/history";

const categoryStyles: Record<AuditActionCategory, string> = {
  create: "border-sky-200 bg-sky-50 text-sky-700",
  update: "border-amber-200 bg-amber-50 text-amber-700",
  delete: "border-rose-200 bg-rose-50 text-rose-700",
  sync: "border-emerald-200 bg-emerald-50 text-emerald-700",
  template: "border-violet-200 bg-violet-50 text-violet-700",
  error: "border-rose-300 bg-rose-100 text-rose-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  system: "border-zinc-200 bg-zinc-100 text-zinc-600"
};

const categoryIcons: Record<AuditActionCategory, typeof Plus> = {
  create: Plus,
  update: RefreshCw,
  delete: Trash2,
  sync: RefreshCw,
  template: Layers,
  error: AlertCircle,
  success: Box,
  system: Settings2
};

interface AuditActionBadgeProps {
  action: string;
}

export function AuditActionBadge({ action }: AuditActionBadgeProps) {
  const category = getActionCategory(action);
  const Icon = categoryIcons[category] ?? Minus;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryStyles[category]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {getActionLabel(category)}
    </span>
  );
}
