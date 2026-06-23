"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
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
  const [wasCopied, setWasCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmationText("");
      setReason("");
      setWasCopied(false);
    }
  }, [isOpen]);

  async function copyConfirmationText() {
    if (!expectedConfirmation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(expectedConfirmation);
      setWasCopied(true);
      window.setTimeout(() => setWasCopied(false), 1800);
    } catch {
      setConfirmationText(expectedConfirmation);
    }
  }

  const expectedConfirmation = useMemo(() => {
    if (!record || !domainName) {
      return "";
    }

    return buildDeleteConfirmationText(record.name, domainName);
  }, [domainName, record]);

  const isConfirmationValid = confirmationText.trim().toLowerCase() === expectedConfirmation;
  const isCloudflareLinked = Boolean(record?.cloudflareRecordId);
  const isSensitive = record ? isSensitiveRecord(record) : false;

  const titleInfo = useMemo(() => {
    if (!record) {
      return undefined;
    }

    const parts: string[] = [];

    if (isCloudflareLinked) {
      parts.push("Você está excluindo um registro DNS real da Cloudflare. Isso pode derrubar sites, APIs ou e-mails.");
    } else {
      parts.push("Este registro não está vinculado à Cloudflare e será removido apenas do MiniHost.");
    }

    if (isSensitive) {
      parts.push("Cuidado: este registro pode afetar site principal, e-mail ou validação de domínio.");
    }

    return parts.join(" ");
  }, [isCloudflareLinked, isSensitive, record]);

  return (
    <Modal
      isOpen={isOpen}
      title="Confirmar exclusão de registro DNS"
      titleInfo={titleInfo}
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
            {isSubmitting ? "Excluindo..." : "Excluir registro"}
          </button>
        </div>
      }
    >
      {record && domainName ? (
        <div className="space-y-4 text-sm text-zinc-700">
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
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Origem</p>
                <FieldInfoTooltip
                  label="Origem do registro"
                  description={isCloudflareLinked ? "Será excluído da Cloudflare." : "Será marcado como excluído apenas no MiniHost."}
                />
              </div>
              <p className="mt-1 font-medium text-zinc-950">{isCloudflareLinked ? "Cloudflare" : "Manual"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Conteúdo</p>
              <p className="mt-1 break-all font-medium text-zinc-950">{formatRecordValue(record)}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="delete-reason">
              Motivo ou outro motivo (opcional)
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
              Para confirmar, digite exatamente o nome final do registro abaixo:{" "}
              <span className="inline-flex max-w-full items-center gap-1 align-middle">
                <span className="truncate font-mono text-rose-700">{expectedConfirmation}</span>
                <button
                  type="button"
                  onClick={() => void copyConfirmationText()}
                  aria-label="Copiar texto de confirmação"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  {wasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </span>
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
