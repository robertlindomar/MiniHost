import type { CloudflareConnectionStatus } from "@/lib/types";

interface SettingsStatusBadgeProps {
  status: CloudflareConnectionStatus;
}

const STATUS_COPY: Record<CloudflareConnectionStatus, { label: string; className: string }> = {
  connected: {
    label: "Token configurado no painel",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  not_configured: {
    label: "Token não configurado",
    className: "border-amber-200 bg-amber-50 text-amber-700"
  },
  error: {
    label: "Último teste com erro",
    className: "border-rose-200 bg-rose-50 text-rose-700"
  },
  not_tested: {
    label: "Token configurado no painel",
    className: "border-sky-200 bg-sky-50 text-sky-700"
  }
};

export function SettingsStatusBadge({ status }: SettingsStatusBadgeProps) {
  const copy = STATUS_COPY[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${copy.className}`}>
      {copy.label}
    </span>
  );
}
