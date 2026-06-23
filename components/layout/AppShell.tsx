"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { getPageMeta } from "@/components/layout/navigation";
import { apiRequest } from "@/lib/api-client";
import type { SessionUser } from "@/lib/auth/session";

import type { CloudflareConnectionStatus } from "@/lib/types";

type SettingsStatusResponse = {
  cloudflare?: {
    connectionStatus: CloudflareConnectionStatus;
  };
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cloudflareStatus, setCloudflareStatus] = useState<CloudflareConnectionStatus>("not_configured");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadShellData() {
      if (pathname === "/login") {
        return;
      }

      try {
        const [userData, settingsData] = await Promise.all([
          apiRequest<{ user: SessionUser }>("/api/auth/me"),
          apiRequest<SettingsStatusResponse>("/api/settings")
        ]);

        setUser(userData.user);
        setCloudflareStatus(settingsData.cloudflare?.connectionStatus ?? "not_configured");
      } catch {
        setUser(null);
        await apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        window.location.assign(`/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    void loadShellData();
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

  const accountName = user?.name?.trim() || user?.email || "MiniHost Admin";

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="lg:flex">
        <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-72 lg:shrink-0">
          <Sidebar
            pathname={pathname}
            accountName={accountName}
            cloudflareStatus={cloudflareStatus}
          />
        </aside>

        <MobileNav
          isOpen={isMobileNavOpen}
          pathname={pathname}
          accountName={accountName}
          cloudflareStatus={cloudflareStatus}
          onClose={() => setIsMobileNavOpen(false)}
        />

        <div className="min-w-0 flex-1">
          <Header
            pageMeta={pageMeta}
            user={user}
            isLoggingOut={isLoggingOut}
            onLogout={() => void handleLogout()}
            onOpenMobileNav={() => setIsMobileNavOpen((current) => !current)}
            isMobileNavOpen={isMobileNavOpen}
          />

          <main className="px-4 py-6 sm:px-5 lg:px-5 lg:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
