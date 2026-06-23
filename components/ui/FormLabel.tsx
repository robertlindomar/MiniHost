import type { ReactNode } from "react";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";

interface FormLabelProps {
  htmlFor?: string;
  children: ReactNode;
  info?: string;
  infoLabel?: string;
  className?: string;
}

export function FormLabel({
  htmlFor,
  children,
  info,
  infoLabel,
  className = "text-sm font-medium text-zinc-800"
}: FormLabelProps) {
  const tooltipLabel = infoLabel ?? (typeof children === "string" ? children : "Informação");

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={htmlFor} className={className}>
        {children}
      </label>
      {info ? <FieldInfoTooltip label={tooltipLabel} description={info} /> : null}
    </div>
  );
}
