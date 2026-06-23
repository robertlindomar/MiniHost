"use client";

import { Pencil, Save, Trash2, X } from "lucide-react";
import { Fragment, useState } from "react";
import { DnsTypeBadge } from "@/components/records/DnsTypeBadge";
import { OriginBadge } from "@/components/records/OriginBadge";
import { ProxyBadge } from "@/components/records/ProxyBadge";
import { RecordStatusBadge } from "@/components/records/RecordStatusBadge";
import { RecordsEmptyState } from "@/components/records/RecordsEmptyState";
import { formatDateTime, formatRecordValue, formatTtl } from "@/lib/format";
import type { DnsRecord, DnsRecordFormInput, Domain, EntityStatus, TtlValue } from "@/lib/types";

export type RecordDisplayMode = "compact" | "detailed";

interface DnsRecordsTableProps {
  records: DnsRecord[];
  domains: Domain[];
  totalRecords: number;
  displayMode: RecordDisplayMode;
  isFiltered?: boolean;
  canSync?: boolean;
  onCreate: () => void;
  onSync: () => void;
  onQuickSave: (record: DnsRecord, input: DnsRecordFormInput) => Promise<void>;
  onDelete: (record: DnsRecord) => void;
}

type QuickEditState = {
  name: string;
  value: string;
  ttlMode: "auto" | "manual";
  ttlValue: string;
  proxied: boolean;
  status: EntityStatus;
  priority: string;
  comment: string;
};

function formatCloudflareId(id?: string) {
  if (!id) {
    return "—";
  }

  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function getDomain(domains: Domain[], domainId: string) {
  return domains.find((domain) => domain.id === domainId);
}

function getDomainName(domains: Domain[], domainId: string) {
  return getDomain(domains, domainId)?.name ?? "Domínio removido";
}

function getFullRecordName(record: DnsRecord, domains: Domain[]) {
  const domainName = getDomainName(domains, record.domainId);

  if (!record.name || record.name === "@") {
    return domainName;
  }

  if (record.name.endsWith(`.${domainName}`)) {
    return record.name;
  }

  return `${record.name}.${domainName}`;
}

function getInitialEditState(record: DnsRecord): QuickEditState {
  return {
    name: record.name,
    value: record.value,
    ttlMode: record.ttl === "auto" ? "auto" : "manual",
    ttlValue: typeof record.ttl === "number" ? String(record.ttl) : "3600",
    proxied: record.proxied,
    status: record.status === "inactive" ? "inactive" : "active",
    priority: typeof record.priority === "number" ? String(record.priority) : "10",
    comment: record.comment ?? ""
  };
}

function isProxyLocked(type: DnsRecord["type"]) {
  return type === "TXT" || type === "MX";
}

function buildInput(record: DnsRecord, editState: QuickEditState): DnsRecordFormInput {
  const ttl: TtlValue = editState.ttlMode === "auto" ? "auto" : Number(editState.ttlValue);

  return {
    domainId: record.domainId,
    type: record.type,
    name: editState.name.trim(),
    value: editState.value.trim(),
    ttl,
    proxied: isProxyLocked(record.type) ? false : editState.proxied,
    status: editState.status,
    priority: record.type === "MX" ? Number(editState.priority) : undefined,
    comment: editState.comment.trim() || undefined
  };
}

function InlineEditRow({
  record,
  domains,
  editState,
  displayMode,
  isSaving,
  onChange,
  onCancel,
  onSave,
  onDelete
}: {
  record: DnsRecord;
  domains: Domain[];
  editState: QuickEditState;
  displayMode: RecordDisplayMode;
  isSaving: boolean;
  onChange: (next: QuickEditState) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const colSpan = displayMode === "detailed" ? 12 : 8;
  const proxyLocked = isProxyLocked(record.type);

  return (
    <tr className="bg-blue-50/30">
      <td colSpan={colSpan} className="border-l-2 border-blue-500 px-4 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_120px_minmax(220px,0.8fr)_180px_120px] xl:items-end">
          <div>
            <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-name-${record.id}`}>
              Nome
            </label>
            <input
              id={`quick-name-${record.id}`}
              value={editState.name}
              onChange={(event) => onChange({ ...editState, name: event.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 truncate text-xs text-zinc-500">{getFullRecordName({ ...record, name: editState.name }, domains)}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-600">Tipo</p>
            <div className="mt-2 h-10 py-2 text-sm font-medium text-zinc-950">{record.type}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-value-${record.id}`}>
              {record.type === "A" ? "Endereço IPv4" : record.type === "AAAA" ? "Endereço IPv6" : "Conteúdo"}
            </label>
            <input
              id={`quick-value-${record.id}`}
              value={editState.value}
              onChange={(event) => onChange({ ...editState, value: event.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-600">Status do proxy</p>
            <label className="mt-1 flex h-10 items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={!proxyLocked && editState.proxied}
                disabled={proxyLocked}
                onChange={(event) => onChange({ ...editState, proxied: event.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <ProxyBadge proxied={!proxyLocked && editState.proxied} />
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-ttl-${record.id}`}>
              TTL
            </label>
            <select
              id={`quick-ttl-${record.id}`}
              value={editState.ttlMode}
              onChange={(event) => onChange({ ...editState, ttlMode: event.target.value as QuickEditState["ttlMode"] })}
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>

        {editState.ttlMode === "manual" || record.type === "MX" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {editState.ttlMode === "manual" ? (
              <div>
                <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-ttl-value-${record.id}`}>
                  TTL em segundos
                </label>
                <input
                  id={`quick-ttl-value-${record.id}`}
                  value={editState.ttlValue}
                  inputMode="numeric"
                  onChange={(event) => onChange({ ...editState, ttlValue: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ) : null}
            {record.type === "MX" ? (
              <div>
                <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-priority-${record.id}`}>
                  Prioridade MX
                </label>
                <input
                  id={`quick-priority-${record.id}`}
                  value={editState.priority}
                  inputMode="numeric"
                  onChange={(event) => onChange({ ...editState, priority: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <details className="mt-4 border-t border-zinc-200 pt-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">Atributos de registro</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-status-${record.id}`}>
                Status
              </label>
              <select
                id={`quick-status-${record.id}`}
                value={editState.status}
                onChange={(event) => onChange({ ...editState, status: event.target.value as EntityStatus })}
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600" htmlFor={`quick-comment-${record.id}`}>
                Comentário interno
              </label>
              <input
                id={`quick-comment-${record.id}`}
                value={editState.comment}
                onChange={(event) => onChange({ ...editState, comment: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Observação local"
              />
            </div>
          </div>
        </details>

        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}

export function DnsRecordsTable({
  records,
  domains,
  totalRecords,
  displayMode,
  isFiltered = false,
  canSync = false,
  onCreate,
  onSync,
  onQuickSave,
  onDelete
}: DnsRecordsTableProps) {
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editState, setEditState] = useState<QuickEditState | null>(null);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const tableMinWidth = displayMode === "detailed" ? "min-w-[1480px]" : "min-w-[980px]";

  function startEdit(record: DnsRecord) {
    setEditingRecordId(record.id);
    setEditState(getInitialEditState(record));
  }

  async function saveInline(record: DnsRecord) {
    if (!editState) {
      return;
    }

    setSavingRecordId(record.id);

    try {
      await onQuickSave(record, buildInput(record, editState));
      setEditingRecordId(null);
      setEditState(null);
    } finally {
      setSavingRecordId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Registros DNS</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Mostrando {records.length} de {totalRecords} {totalRecords === 1 ? "registro" : "registros"}.
          </p>
        </div>
      </div>

      {records.length === 0 ? (
        <RecordsEmptyState isFiltered={isFiltered} canSync={canSync} onCreate={onCreate} onSync={onSync} />
      ) : (
        <div className="overflow-x-auto">
          <table className={`${tableMinWidth} w-full border-collapse`}>
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs font-semibold text-zinc-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Conteúdo</th>
                <th className="px-4 py-3">Status do proxy</th>
                <th className="px-4 py-3">TTL</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Status</th>
                {displayMode === "detailed" ? (
                  <>
                    <th className="px-4 py-3">Domínio</th>
                    <th className="px-4 py-3">Última sincronização</th>
                    <th className="px-4 py-3">ID Cloudflare</th>
                    <th className="px-4 py-3">Criado em</th>
                  </>
                ) : null}
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {records.map((record) => {
                const value = formatRecordValue(record);
                const isEditing = editingRecordId === record.id && editState;

                return (
                  <Fragment key={record.id}>
                    <tr className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                      <td className="px-4 py-4">
                        <span title={getFullRecordName(record, domains)} className="block max-w-[260px] truncate font-semibold text-zinc-950">
                          {getFullRecordName(record, domains)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <DnsTypeBadge type={record.type} />
                      </td>
                      <td className="px-4 py-4">
                        <span title={value} className="block max-w-[300px] truncate text-zinc-700">
                          {value}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ProxyBadge proxied={record.proxied} />
                      </td>
                      <td className="px-4 py-4">{formatTtl(record.ttl)}</td>
                      <td className="px-4 py-4">
                        <OriginBadge source={record.source} />
                      </td>
                      <td className="px-4 py-4">
                        <RecordStatusBadge record={record} />
                      </td>
                      {displayMode === "detailed" ? (
                        <>
                          <td className="px-4 py-4 text-zinc-600">{getDomainName(domains, record.domainId)}</td>
                          <td className="px-4 py-4 text-zinc-600">{record.lastSyncedAt ? formatDateTime(record.lastSyncedAt) : "—"}</td>
                          <td className="px-4 py-4">
                            <span className="font-mono text-xs text-zinc-500">{formatCloudflareId(record.cloudflareRecordId)}</span>
                          </td>
                          <td className="px-4 py-4 text-zinc-600">{formatDateTime(record.createdAt)}</td>
                        </>
                      ) : null}
                      <td className="px-4 py-4 text-right">
                        {record.status === "DELETED" ? (
                          <span className="text-xs text-zinc-400">Sem ações</span>
                        ) : isEditing ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecordId(null);
                              setEditState(null);
                            }}
                            className="text-sm font-medium text-zinc-700 transition hover:text-zinc-950"
                          >
                            Fechar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(record)}
                            className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                    {isEditing ? (
                      <InlineEditRow
                        record={record}
                        domains={domains}
                        editState={editState}
                        displayMode={displayMode}
                        isSaving={savingRecordId === record.id}
                        onChange={setEditState}
                        onCancel={() => {
                          setEditingRecordId(null);
                          setEditState(null);
                        }}
                        onSave={() => void saveInline(record)}
                        onDelete={() => {
                          setEditingRecordId(null);
                          setEditState(null);
                          onDelete(record);
                        }}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
