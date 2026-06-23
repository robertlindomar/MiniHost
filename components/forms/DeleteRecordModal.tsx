"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { Modal } from "@/components/ui/Modal";
import { formatRecordValue } from "@/lib/format";
import type { DnsRecord } from "@/lib/types";
import { buildDeleteConfirmationText, isSensitiveRecord } from "@/lib/validation";

interface DeleteRecordModalProps {
  record?: DnsRecord;
  domainName?: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (input: { confirmationText: string; reason: string }) => void | Promise<void>;
}

export function DeleteRecordModal({
  record,
  domainName,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm
}: DeleteRecordModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setConfirmationText("");
      setReason("");
    }
  }, [isOpen]);

  const expectedConfirmation = useMemo(() => {
    if (!record || !domainName) {
      return "";
    }

    return buildDeleteConfirmationText(record.name, domainName);
  }, [domainName, record]);

  const isConfirmationValid = confirmationText.trim().toLowerCase() === expectedConfirmation;
  const isCloudflareLinked = Boolean(record?.cloudflareRecordId);
  const isSensitive = record ? isSensitiveRecord(record) : false;

  return (
    <Modal
      isOpen={isOpen}
      title="Excluir registro DNS"
      onClose={onCancel}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirm({ confirmationText: confirmationText.trim(), reason: reason.trim() })}
            disabled={isSubmitting || !isConfirmationValid}
            className="inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Excluindo..." : isCloudflareLinked ? "Excluir da Cloudflare" : "Marcar como excluído"}
          </button>
        </div>
      }
    >
      {record && domainName ? (
        <div className="space-y-4 text-sm text-zinc-700">
          {isCloudflareLinked ? (
            <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Você está prestes a excluir um registro DNS real da Cloudflare. Essa ação pode derrubar sites, APIs ou
                e-mails.
              </p>
            </div>
          ) : null}

          {!isCloudflareLinked ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900">
              Este registro não está vinculado à Cloudflare. Ele será removido apenas do MiniHost.
            </div>
          ) : null}

          <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Domínio</p>
              <p className="mt-1 font-medium text-zinc-950">{domainName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tipo</p>
              <p className="mt-1 font-medium text-zinc-950">{record.type}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Nome</p>
              <p className="mt-1 font-medium text-zinc-950">{record.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Proxy ativo</p>
              <p className="mt-1 font-medium text-zinc-950">{record.proxied ? "Sim" : "Não"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Conteúdo</p>
              <p className="mt-1 break-all font-medium text-zinc-950">{formatRecordValue(record)}</p>
            </div>
          </div>

          {isSensitive ? (
            <div className="flex gap-3 rounded-lg border border-rose-300 bg-rose-100 p-4 text-rose-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cuidado: este registro pode afetar site principal, e-mail ou validação de domínio.</p>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="delete-reason">
              Motivo da exclusão (opcional)
            </label>
            <input
              id="delete-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={fieldClass}
              placeholder="Registro de teste"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="delete-confirmation">
              Digite <span className="font-mono text-rose-700">{expectedConfirmation}</span> para confirmar
            </label>
            <input
              id="delete-confirmation"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              className={fieldClass}
              placeholder={expectedConfirmation}
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
