import type { ReactNode } from "react";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";

interface FormFieldProps {
  id: string;
  label: string;
  info?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ id, label, info, error, children }: FormFieldProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-800">
          {label}
        </label>
        {info ? <FieldInfoTooltip label={label} description={info} /> : null}
      </div>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

export const settingsFieldClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400";

export const settingsFieldErrorClass =
  "w-full rounded-md border border-rose-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400";
