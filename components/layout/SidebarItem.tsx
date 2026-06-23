import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onNavigate?: () => void;
}

export function SidebarItem({ href, label, icon: Icon, isActive, onNavigate }: SidebarItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        isActive
          ? "bg-blue-600/20 text-white ring-1 ring-inset ring-blue-500/40"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200"}`} />
      <span>{label}</span>
    </Link>
  );
}
