import { getEntityDisplay } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

interface EntityBadgeProps {
  item: HistoryItem;
}

export function EntityBadge({ item }: EntityBadgeProps) {
  const entity = getEntityDisplay(item);

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-zinc-950">{entity.label}</p>
      <p className="mt-0.5 truncate text-xs text-zinc-500">{entity.identifier}</p>
    </div>
  );
}
