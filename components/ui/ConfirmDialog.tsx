"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmingLabel?: string;
  variant?: "danger" | "primary";
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  warning,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  confirmingLabel,
  variant = "danger",
  isConfirming = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const confirmButtonClass =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      : "inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70";
  const defaultConfirmingLabel = variant === "primary" ? "Confirmando..." : "Excluindo...";

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={confirmButtonClass}
          >
            {isConfirming ? confirmingLabel ?? defaultConfirmingLabel : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-zinc-600">{message}</p>
      {warning ? (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{warning}</p>
        </div>
      ) : null}
    </Modal>
  );
}
