interface SettingsStatusBadgeProps {
  configured: boolean;
}

export function SettingsStatusBadge({ configured }: SettingsStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        configured
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {configured ? "Cloudflare configurado" : "Configuração pendente"}
    </span>
  );
}
