import { Cloud } from "lucide-react";

export function ProxyBadge({ proxied }: { proxied: boolean }) {
  if (!proxied) {
    return (
      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
        Não
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <Cloud className="h-3.5 w-3.5" />
      Sim
    </span>
  );
}
