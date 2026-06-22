import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <strong className="mt-3 block text-3xl font-semibold tracking-normal text-zinc-950">{value}</strong>
        </div>
        {icon ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-700">{icon}</div> : null}
      </div>
      {description ? <p className="mt-4 text-sm text-zinc-500">{description}</p> : null}
    </section>
  );
}
