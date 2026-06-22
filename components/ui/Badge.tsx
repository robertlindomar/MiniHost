import type { ReactNode } from "react";

type BadgeVariant = "success" | "muted" | "warning" | "danger" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  muted: "border-zinc-200 bg-zinc-100 text-zinc-600",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700"
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "muted" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
