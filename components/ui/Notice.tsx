import { AlertCircle, CheckCircle2 } from "lucide-react";

interface NoticeProps {
  type: "success" | "error" | "info";
  message: string;
}

const classes = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

export function Notice({ type, message }: NoticeProps) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${classes[type]}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
