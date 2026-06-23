import type { CloudflareConnectionStatus } from "@/lib/types";

interface CloudflareStatusBadgeProps {
  status: CloudflareConnectionStatus;
  compact?: boolean;
}

const STATUS_COPY: Record<CloudflareConnectionStatus, { label: string; dotClass: string; textClass: string }> = {
  connected: {
    label: "Cloudflare conectado",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-300"
  },
  not_configured: {
    label: "Cloudflare não configurado",
    dotClass: "bg-zinc-400",
    textClass: "text-zinc-300"
  },
  error: {
    label: "Cloudflare com erro",
    dotClass: "bg-rose-400",
    textClass: "text-rose-200"
  },
  not_tested: {
    label: "Cloudflare não testado",
    dotClass: "bg-amber-400",
    textClass: "text-amber-200"
  }
};

export function CloudflareStatusBadge({ status, compact = false }: CloudflareStatusBadgeProps) {
  const copy = STATUS_COPY[status];

  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${copy.dotClass}`} aria-hidden="true" />
      <span className={copy.textClass}>{copy.label}</span>
    </div>
  );
}
