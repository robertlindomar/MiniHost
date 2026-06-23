"use client";

import { AlertTriangle } from "lucide-react";
import { AuditActionBadge } from "@/components/history/AuditActionBadge";
import { EntityBadge } from "@/components/history/EntityBadge";
import { UserAvatar } from "@/components/history/UserAvatar";
import { Modal } from "@/components/ui/Modal";
import { formatAuditDateTime } from "@/lib/format";
import { getActionCategory, maskSensitiveData } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

interface AuditLogDetailsDialogProps {
  item?: HistoryItem;
  onClose: () => void;
}

function JsonBlock({ title, value }: { title: string; value?: unknown }) {
  if (value === undefined || value === null) {
    return null;
  }

  const masked = maskSensitiveData(value);
  const content = JSON.stringify(masked, null, 2);

  return (
    <section>
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs leading-6 text-zinc-700">
        {content}
      </pre>
    </section>
  );
}

export function AuditLogDetailsDialog({ item, onClose }: AuditLogDetailsDialogProps) {
  if (!item) {
    return null;
  }

  const isError = getActionCategory(item.action) === "error";
  const errorMessage =
    typeof item.newData === "object" && item.newData && "error" in (item.newData as Record<string, unknown>)
      ? String((item.newData as Record<string, unknown>).error)
      : isError
        ? item.description
        : undefined;

  return (
    <Modal isOpen={Boolean(item)} title="Detalhes do evento" onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ação</p>
            <div className="mt-2">
              <AuditActionBadge action={item.action} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Data/hora</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatAuditDateTime(item.timestamp)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entidade afetada</p>
          <div className="mt-2">
            <EntityBadge item={item} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Usuário</p>
            <div className="mt-2">
              <UserAvatar item={item} showEmail />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">ID técnico</p>
            <p className="mt-2 break-all font-mono text-xs text-zinc-600">{item.id}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Descrição</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{item.description}</p>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-rose-800">Erro registrado</p>
                <p className="mt-1 text-sm leading-6 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : null}

        <JsonBlock title="Dados antigos" value={item.oldData} />
        <JsonBlock title="Dados novos" value={item.newData} />
      </div>
    </Modal>
  );
}
