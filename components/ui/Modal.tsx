"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
}

export function Modal({ isOpen, title, children, footer, onClose, size = "md" }: ModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", onKeyDown);
    }

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const sizeClass = size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-t-xl bg-white shadow-soft sm:rounded-xl ${sizeClass}`}>
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
