import type { CoolifyConnectionStatus } from "@/lib/types";

interface CoolifyStatusBadgeProps {
  status: CoolifyConnectionStatus;
}

const STATUS_COPY: Record<CoolifyConnectionStatus, { label: string; className: string }> = {
  connected: {
    label: "Coolify conectado",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  not_configured: {
    label: "Coolify não configurado",
    className: "border-amber-200 bg-amber-50 text-amber-700"
  },
  error: {
    label: "Último teste com erro",
    className: "border-rose-200 bg-rose-50 text-rose-700"
  },
  not_tested: {
    label: "Coolify não testado",
    className: "border-sky-200 bg-sky-50 text-sky-700"
  }
};

export function CoolifyStatusBadge({ status }: CoolifyStatusBadgeProps) {
  const copy = STATUS_COPY[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${copy.className}`}>
      {copy.label}
    </span>
  );
}
