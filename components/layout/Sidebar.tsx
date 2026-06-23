import { ExternalLink, Layers3 } from "lucide-react";
import Link from "next/link";
import { CloudflareStatusBadge } from "@/components/layout/CloudflareStatusBadge";
import { SidebarItem } from "@/components/layout/SidebarItem";
import { APP_VERSION, navigation } from "@/components/layout/navigation";

interface SidebarProps {
  pathname: string;
  accountName: string;
  cloudflareConfigured: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ pathname, accountName, cloudflareConfigured, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-900/30">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-none">MiniHost</p>
            <p className="mt-1 text-xs text-slate-400">DNS & Infra Panel</p>
          </div>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={pathname === "/" ? item.href === "/dashboard" : pathname.startsWith(item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <CloudflareStatusBadge configured={cloudflareConfigured} />
          <p className="mt-3 text-xs text-slate-400">Conta: {accountName}</p>
          <Link
            href="/settings"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 transition hover:text-blue-200"
          >
            Ver integração
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">{APP_VERSION}</span>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Atualizado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
