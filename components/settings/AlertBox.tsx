import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type AlertBoxType = "success" | "error" | "info" | "warning";

interface AlertBoxProps {
  type: AlertBoxType;
  message: string;
}

const classes: Record<AlertBoxType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800"
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertCircle
};

export function AlertBox({ type, message }: AlertBoxProps) {
  const Icon = icons[type];

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${classes[type]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-6">{message}</span>
    </div>
  );
}
