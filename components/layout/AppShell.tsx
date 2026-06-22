"use client";

import {
  Globe2,
  History,
  LayoutDashboard,
  ListTree,
  Settings,
  Server
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-zinc-200 bg-white/90 px-5 py-5 backdrop-blur md:px-8">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-emerald-700">MiniHost</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">{title}</h1>
          </div>
        </header>

        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
