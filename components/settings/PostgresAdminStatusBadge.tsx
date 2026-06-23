import type { PostgresConnectionStatus } from "@/lib/types";

interface PostgresAdminStatusBadgeProps {
  status: PostgresConnectionStatus;
}

const STATUS_COPY: Record<PostgresConnectionStatus, { label: string; className: string }> = {
  connected: {
    label: "Credencial configurada — último teste OK",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  not_configured: {
    label: "Credencial não configurada",
    className: "border-amber-200 bg-amber-50 text-amber-700"
  },
  error: {
    label: "Último teste com erro",
    className: "border-rose-200 bg-rose-50 text-rose-700"
  },
  not_tested: {
    label: "Credencial configurada — não testada",
    className: "border-sky-200 bg-sky-50 text-sky-700"
  }
};

export function PostgresAdminStatusBadge({ status }: PostgresAdminStatusBadgeProps) {
  const copy = STATUS_COPY[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${copy.className}`}>
      {copy.label}
    </span>
  );
}
