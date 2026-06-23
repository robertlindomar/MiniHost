"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
}

const toastClasses: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-emerald-900 shadow-[0_20px_60px_rgba(16,185,129,0.18)]",
  error: "border-rose-200 bg-white text-rose-900 shadow-[0_20px_60px_rgba(244,63,94,0.18)]",
  info: "border-sky-200 bg-white text-sky-900 shadow-[0_20px_60px_rgba(14,165,233,0.18)]"
};

const iconClasses: Record<ToastType, string> = {
  success: "bg-emerald-50 text-emerald-600",
  error: "bg-rose-50 text-rose-600",
  info: "bg-sky-50 text-sky-600"
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

export function Toast({ type, message, onClose }: ToastProps) {
  const Icon = icons[type];

  return (
    <div className="fixed right-4 top-24 z-50 w-[calc(100vw-2rem)] max-w-sm md:right-6">
      <div className={`flex items-start gap-3 rounded-lg border p-4 ${toastClasses[type]}`}>
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClasses[type]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="min-w-0 flex-1 text-sm leading-6 text-zinc-700">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar notificação"
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
