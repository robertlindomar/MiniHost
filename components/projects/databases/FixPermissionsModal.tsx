"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Modal } from "@/components/ui/Modal";
import { buildFixPermissionsConfirmationText, buildMaskedFixPermissionsSql } from "@/lib/provision";
import type { ProjectDatabase } from "@/lib/types";

interface FixPermissionsModalProps {
  database?: ProjectDatabase;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (confirmationText: string) => void;
}

export function FixPermissionsModal({
  database,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm
}: FixPermissionsModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [wasCopied, setWasCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmationText("");
      setWasCopied(false);
    }
  }, [isOpen, database?.id]);

  async function copyConfirmationText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setWasCopied(true);
      window.setTimeout(() => setWasCopied(false), 2000);
    } catch {
      setWasCopied(false);
    }
  }

  if (!database) {
    return null;
  }

  const expectedText = buildFixPermissionsConfirmationText(database.databaseName);
  const maskedSql = buildMaskedFixPermissionsSql(database.databaseUser, database.databaseName);
  const isValid = confirmationText === expectedText;

  return (
    <Modal isOpen={isOpen} title="Corrigir permissões" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-zinc-600">
          Esta ação revoga CONNECT de PUBLIC no banco do projeto, garante CONNECT apenas para{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono">{database.databaseUser}</code> e tenta revogar CONNECT
          desse usuário nos demais bancos. O usuário <code className="rounded bg-zinc-100 px-1 font-mono">postgres</code>{" "}
          não será alterado.
        </p>

        <CodeBlock content={maskedSql} label="SQL aplicado (resumo)" />

        <div>
          <label htmlFor="fix-permissions-confirmation" className="block text-sm font-medium text-zinc-700">
            Confirmação
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
            id="fix-permissions-confirmation"
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
            onClick={() => onConfirm(confirmationText)}
            disabled={isSubmitting || !isValid}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Corrigindo...
              </>
            ) : (
              "Corrigir permissões"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
