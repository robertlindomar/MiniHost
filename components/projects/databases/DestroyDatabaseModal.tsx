"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectDatabaseStatusBadge } from "@/components/projects/databases/ProjectDatabaseStatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { buildDestroyConfirmationText } from "@/lib/database-danger";
import type { Project, ProjectDatabase } from "@/lib/types";

interface DestroyDatabaseModalProps {
  database?: ProjectDatabase;
  project?: Project;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (confirmationText: string) => void;
}

export function DestroyDatabaseModal({
  database,
  project,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm
}: DestroyDatabaseModalProps) {
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

  const expectedText = buildDestroyConfirmationText(database.databaseName);
  const isValid = confirmationText === expectedText;

  return (
    <Modal isOpen={isOpen} title="Destruir banco e usuário" onClose={onClose}>
      <div className="space-y-5">
        <Notice
          type="error"
          message="Esta ação é irreversível. O banco e o usuário serão removidos do PostgreSQL. O registro permanecerá no MiniHost apenas como histórico."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {project ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-zinc-500">Projeto</p>
              <p className="mt-1 text-sm text-zinc-900">{project.name}</p>
            </div>
          ) : null}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Database</p>
            <p className="mt-1 font-mono text-sm text-zinc-900">{database.databaseName}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Usuário</p>
            <p className="mt-1 font-mono text-sm text-zinc-900">{database.databaseUser}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Host</p>
            <p className="mt-1 text-sm text-zinc-900">{database.host}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Porta</p>
            <p className="mt-1 text-sm text-zinc-900">{database.port}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase text-zinc-500">Status atual</p>
            <div className="mt-2">
              <ProjectDatabaseStatusBadge status={database.status} />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="destroy-confirmation" className="block text-sm font-medium text-zinc-700">
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
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
              >
                {wasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </span>
          </p>
          <input
            id="destroy-confirmation"
            value={confirmationText}
            disabled={isSubmitting}
            onChange={(event) => setConfirmationText(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
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
            className="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Destruindo...
              </>
            ) : (
              "Destruir banco e usuário"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
