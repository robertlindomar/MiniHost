import { getUserDisplay } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

const avatarPalette = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700"
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "S";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getAvatarClass(name: string, isSystem: boolean) {
  if (isSystem) {
    return "bg-zinc-100 text-zinc-600";
  }

  const hash = name.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return avatarPalette[hash % avatarPalette.length];
}

interface UserAvatarProps {
  item: HistoryItem;
  showEmail?: boolean;
}

export function UserAvatar({ item, showEmail = false }: UserAvatarProps) {
  const user = getUserDisplay(item);

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarClass(user.name, user.isSystem)}`}
      >
        {getInitials(user.name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
        {showEmail && user.email ? <p className="truncate text-xs text-zinc-500">{user.email}</p> : null}
      </div>
    </div>
  );
}
