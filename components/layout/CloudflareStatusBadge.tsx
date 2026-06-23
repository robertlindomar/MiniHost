interface CloudflareStatusBadgeProps {
  configured: boolean;
  compact?: boolean;
}

export function CloudflareStatusBadge({ configured, compact = false }: CloudflareStatusBadgeProps) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${configured ? "bg-emerald-400" : "bg-amber-400"}`}
        aria-hidden="true"
      />
      <span className={configured ? "text-emerald-300" : "text-amber-200"}>
        {configured ? "Cloudflare conectado" : "Cloudflare pendente"}
      </span>
    </div>
  );
}
