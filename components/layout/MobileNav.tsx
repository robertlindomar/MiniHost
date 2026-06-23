"use client";

import { Sidebar } from "@/components/layout/Sidebar";

import type { CloudflareConnectionStatus } from "@/lib/types";

interface MobileNavProps {
  isOpen: boolean;
  pathname: string;
  accountName: string;
  cloudflareStatus: CloudflareConnectionStatus;
  onClose: () => void;
}

export function MobileNav({ isOpen, pathname, accountName, cloudflareStatus, onClose }: MobileNavProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-[1px] lg:hidden"
      />
      <aside className="fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,18rem)] shadow-2xl lg:hidden">
        <Sidebar
          pathname={pathname}
          accountName={accountName}
          cloudflareStatus={cloudflareStatus}
          onNavigate={onClose}
        />
      </aside>
    </>
  );
}
