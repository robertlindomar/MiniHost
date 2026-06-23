import { Menu, X } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { UserMenu } from "@/components/layout/UserMenu";
import type { PageMeta } from "@/components/layout/navigation";

interface HeaderProps {
  pageMeta: PageMeta;
  user: SessionUser | null;
  isLoggingOut?: boolean;
  onLogout: () => void;
  onOpenMobileNav: () => void;
  isMobileNavOpen?: boolean;
}

export function Header({
  pageMeta,
  user,
  isLoggingOut = false,
  onLogout,
  onOpenMobileNav,
  isMobileNavOpen = false
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 lg:hidden"
            aria-label={isMobileNavOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMobileNavOpen}
          >
            {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-zinc-950 sm:text-2xl">{pageMeta.title}</h1>
            {pageMeta.description ? (
              <p className="mt-1 hidden text-sm text-zinc-500 md:block">{pageMeta.description}</p>
            ) : null}
          </div>
        </div>

        <UserMenu user={user} isLoggingOut={isLoggingOut} onLogout={onLogout} compact />
      </div>
    </header>
  );
}
