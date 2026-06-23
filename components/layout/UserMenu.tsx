import { LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";

const avatarPalette = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700"
];

function getInitials(user: SessionUser | null) {
  const name = user?.name?.trim() || user?.email?.trim() || "MH";
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function getAvatarClass(user: SessionUser | null) {
  const label = user?.name || user?.email || "MiniHost";
  const hash = label.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return avatarPalette[hash % avatarPalette.length];
}

interface UserMenuProps {
  user: SessionUser | null;
  isLoggingOut?: boolean;
  onLogout: () => void;
  compact?: boolean;
}

export function UserMenu({ user, isLoggingOut = false, onLogout, compact = false }: UserMenuProps) {
  const displayName = user?.name?.trim() || user?.email || "Administrador";
  const displayEmail = user?.email || "admin@minihost.local";

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "sm:gap-4"}`}>
      <div className={`flex min-w-0 items-center gap-3 ${compact ? "" : "sm:gap-3"}`}>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarClass(user)}`}
        >
          {getInitials(user)}
        </div>
        {!compact ? (
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-zinc-950">{displayName}</p>
            <p className="truncate text-xs text-zinc-500">{displayEmail}</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogOut className="h-4 w-4" />
        <span className={compact ? "sr-only sm:not-sr-only" : ""}>{isLoggingOut ? "Saindo..." : "Sair"}</span>
      </button>
    </div>
  );
}
