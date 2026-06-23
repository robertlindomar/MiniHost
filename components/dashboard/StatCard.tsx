import type { ReactNode } from "react";

type StatTone = "blue" | "violet" | "emerald" | "amber";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  tone?: StatTone;
  isLoading?: boolean;
}

const toneClasses: Record<StatTone, string> = {
  blue: "border-blue-100 bg-blue-50 text-blue-600",
  violet: "border-violet-100 bg-violet-50 text-violet-600",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-600",
  amber: "border-amber-100 bg-amber-50 text-amber-600"
};

export function StatCard({ title, value, description, icon, tone = "blue", isLoading = false }: StatCardProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-600">{title}</p>
          {isLoading ? (
            <div className="mt-5 h-8 w-24 rounded-md bg-zinc-100" />
          ) : (
            <strong className="mt-4 block text-3xl font-semibold text-zinc-950">{value}</strong>
          )}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>
      {isLoading ? (
        <div className="mt-4 h-4 w-40 rounded-md bg-zinc-100" />
      ) : (
        <p className="mt-4 text-sm text-zinc-500">{description}</p>
      )}
    </section>
  );
}
