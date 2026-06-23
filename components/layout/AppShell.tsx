"use client";

import {
  Globe2,
  History,
  LayoutDashboard,
  ListTree,
  LogOut,
  Settings,
  Server,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { SessionUser } from "@/lib/auth/session";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domínios", icon: Globe2 },
  { href: "/records", label: "Registros DNS", icon: ListTree },
  { href: "/history", label: "Histórico", icon: History },
  { href: "/settings", label: "Configurações", icon: Settings }
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/domains": "Domínios",
  "/records": "Registros DNS",
  "/history": "Histórico",
  "/settings": "Configurações"
};

function getPageTitle(pathname: string) {
  const match = navigation.find((item) => pathname.startsWith(item.href));
  return match ? pageTitles[match.href] : "Dashboard";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (pathname === "/login") {
        return;
      }

      try {
        const data = await apiRequest<{ user: SessionUser }>("/api/auth/me");
        setUser(data.user);
      } catch {
        setUser(null);
        await apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        window.location.assign(`/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    void loadUser();
  }, [pathname]);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await apiRequest<{ ok: boolean }>("/api/auth/logout", {
        method: "POST"
      });
    } finally {
      window.location.assign("/login");
    }
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-zinc-950 md:flex">
      <aside className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur md:h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">MiniHost</p>
              <p className="mt-1 text-xs text-zinc-500">DNS local da sua VPS</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible md:px-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-w-max items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition md:min-w-0 ${
                    isActive
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden border-t border-zinc-200 p-4 md:block">
            <div className="mb-3 flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-zinc-700 shadow-sm">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-950">{user?.name ?? "Administrador"}</p>
                <p className="truncate text-xs text-zinc-500">{user?.email ?? "admin@minihost.local"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-zinc-200 bg-white/90 px-5 py-5 backdrop-blur md:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-emerald-700">MiniHost</p>
              <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">{title}</h1>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70 md:hidden"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </header>

        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
