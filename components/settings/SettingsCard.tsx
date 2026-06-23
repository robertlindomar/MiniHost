import type { ReactNode } from "react";

interface SettingsCardProps {
  title: string;
  description?: string;
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function SettingsCard({ title, description, icon, badge, children, footer }: SettingsCardProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-4 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-700">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
            {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
          </div>
        </div>
        {badge ? <div className="sm:pt-1">{badge}</div> : null}
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
      {footer ? <div className="border-t border-zinc-100 px-5 py-4">{footer}</div> : null}
    </section>
  );
}
