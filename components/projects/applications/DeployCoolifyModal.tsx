"use client";

import { Check, Copy, Loader2, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { buildDeployConfirmationText } from "@/lib/coolify-provision";
import type { ProjectApplication } from "@/lib/types";

interface DeployCoolifyModalProps {
  application?: ProjectApplication;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (input: { confirmationText: string }) => void;
}

export function DeployCoolifyModal({
  application,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm
}: DeployCoolifyModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [wasCopied, setWasCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmationText("");
      setWasCopied(false);
    }
  }, [isOpen, application?.id]);

  if (!application) {
    return null;
  }

  const expectedText = buildDeployConfirmationText(application.slug);
  const isValidConfirmation = confirmationText === expectedText;

  async function copyConfirmationText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setWasCopied(true);
      window.setTimeout(() => setWasCopied(false), 2000);
    } catch {
      setWasCopied(false);
    }
  }

  return (
    <Modal isOpen={isOpen} title="Deploy no Coolify" size="lg" onClose={onClose}>
      <div className="space-y-5">
        <Notice
          type="info"
          message="O deploy será disparado manualmente no Coolify para a aplicação vinculada. O status local será atualizado para DEPLOYING e sincronizado em seguida."
        />

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-zinc-950">Aplicação</p>
          <p className="mt-2 text-sm text-zinc-700">{application.name}</p>
          <p className="mt-1 font-mono text-xs text-zinc-500">{application.slug}</p>
          <p className="mt-2 text-sm text-zinc-600">Domínio: {application.domain || "-"}</p>
          <p className="mt-1 text-sm text-zinc-600">Repositório: {application.gitRepository || "-"}</p>
        </div>

        <div>
          <label htmlFor="deploy-confirmation" className="block text-sm font-medium text-zinc-700">
            Confirmação forte
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Digite exatamente:{" "}
            <span className="inline-flex max-w-full items-center gap-1 align-middle">
              <code className="truncate rounded bg-zinc-100 px-1 py-0.5 font-mono">{expectedText}</code>
              <button
                type="button"
                onClick={() => void copyConfirmationText(expectedText)}
                aria-label="Copiar texto de confirmação"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-violet-600 transition hover:bg-violet-50 hover:text-violet-700"
              >
                {wasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </span>
          </p>
          <input
            id="deploy-confirmation"
            value={confirmationText}
            disabled={isSubmitting}
            onChange={(event) => setConfirmationText(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            placeholder={expectedText}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ confirmationText })}
            disabled={isSubmitting || !isValidConfirmation}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando deploy...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Deploy no Coolify
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
