"use client";

import { Cloud, Pencil, Plus, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DnsRecordForm } from "@/components/forms/DnsRecordForm";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiRequest } from "@/lib/api-client";
import { formatDate, formatDateTime, formatRecordSummary, formatRecordValue, formatTtl } from "@/lib/format";
import type { DnsRecord, DnsRecordFormInput, Domain } from "@/lib/types";
import { isSensitiveRecord } from "@/lib/validation";

type NoticeState = { type: "success" | "error" | "info"; message: string } | null;
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };
type CloudflareSyncResponse = { imported: number; updated: number; total: number; records: DnsRecord[] };
type CloudflareCreateRecordResponse = { message: string; record: DnsRecord };
type CloudflareUpdateRecordResponse = { message: string; record: DnsRecord };
type LocalUpdateRecordResponse = { message: string; record: DnsRecord };

type PendingCloudflareUpdate = {
  record: DnsRecord;
  input: DnsRecordFormInput;
};

function formatCloudflareId(id?: string) {
  if (!id) {
    return "-";
  }

  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

export function RecordsPage() {
  const searchParams = useSearchParams();
  const domainFromUrl = searchParams.get("domain");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [domainFilter, setDomainFilter] = useState(domainFromUrl ?? "all");
  const [editingRecord, setEditingRecord] = useState<DnsRecord | undefined>();
  const [recordToDelete, setRecordToDelete] = useState<DnsRecord | undefined>();
  const [pendingCloudflareUpdate, setPendingCloudflareUpdate] = useState<PendingCloudflareUpdate | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  async function reload() {
    try {
      setIsLoading(true);
      const [domainData, recordData] = await Promise.all([
        apiRequest<DomainsResponse>("/api/domains"),
        apiRequest<RecordsResponse>("/api/records")
      ]);
      setDomains(domainData.domains);
      setRecords(recordData.records);
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível carregar registros DNS."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setDomainFilter(domainFromUrl ?? "all");
  }, [domainFromUrl]);

  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain.name])), [domains]);

  const filteredRecords = useMemo(() => {
    if (domainFilter === "all") {
      return records;
    }

    return records.filter((record) => record.domainId === domainFilter);
  }, [domainFilter, records]);

  const syncDomain = useMemo(() => {
    if (domainFilter !== "all") {
      return domains.find((domain) => domain.id === domainFilter);
    }

    return domains.length === 1 ? domains[0] : undefined;
  }, [domainFilter, domains]);

  function openCreateModal() {
    if (domains.length === 0) {
      setNotice({ type: "error", message: "Cadastre um domínio antes de criar registros DNS." });
      return;
    }

    setEditingRecord(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(record: DnsRecord) {
    setEditingRecord(record);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRecord(undefined);
  }

  async function handleCloudflareSync() {
    if (!syncDomain) {
      setNotice({ type: "error", message: "Selecione um domínio para sincronizar com Cloudflare." });
      return;
    }

    if (!syncDomain.zoneId) {
      setNotice({ type: "error", message: "Para sincronizar com Cloudflare, configure o Zone ID deste domínio." });
      return;
    }

    try {
      setIsSyncing(true);
      const result = await apiRequest<CloudflareSyncResponse>("/api/cloudflare/sync-zone", {
        method: "POST",
        body: JSON.stringify({ domainId: syncDomain.id })
      });
      setNotice({
        type: "success",
        message: `Sincronização concluída: ${result.imported} registros importados e ${result.updated} atualizados.`
      });
      await reload();
    } catch (requestError) {
      setNotice({
        type: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível sincronizar com a Cloudflare. Verifique o token e o Zone ID."
      });
    } finally {
      setIsSyncing(false);
    }
  }

  function buildSummaryFromInput(input: DnsRecordFormInput, record: DnsRecord) {
    return formatRecordSummary({
      name: input.name,
      type: record.type,
      value: input.value,
      proxied: input.proxied,
      priority: input.priority
    });
  }

  async function handleSubmit(input: DnsRecordFormInput) {
    try {
      if (editingRecord?.cloudflareRecordId) {
        setPendingCloudflareUpdate({ record: editingRecord, input });
        closeModal();
        return;
      }

      setIsSubmitting(true);

      if (editingRecord) {
        const result = await apiRequest<LocalUpdateRecordResponse>(`/api/records/${editingRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: result.message || "Registro atualizado apenas localmente." });
      } else if (input.createInCloudflare) {
        const result = await apiRequest<CloudflareCreateRecordResponse>("/api/cloudflare/create-record", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: result.message || "Registro criado na Cloudflare com sucesso." });
      } else {
        await apiRequest<{ record: DnsRecord }>("/api/records", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: "Registro criado apenas localmente." });
      }

      closeModal();
      await reload();
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar o registro DNS."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmCloudflareUpdate() {
    if (!pendingCloudflareUpdate) {
      return;
    }

    const { record, input } = pendingCloudflareUpdate;

    try {
      setIsSubmitting(true);
      const result = await apiRequest<CloudflareUpdateRecordResponse>("/api/cloudflare/update-record", {
        method: "PATCH",
        body: JSON.stringify({
          recordId: record.id,
          name: input.name,
          content: input.value,
          ttl: input.ttl,
          proxied: input.proxied,
          status: input.status,
          comment: input.comment ?? "",
          priority: input.priority
        })
      });
      setNotice({ type: "success", message: result.message || "Registro atualizado na Cloudflare com sucesso." });
      setPendingCloudflareUpdate(undefined);
      await reload();
    } catch (requestError) {
      setNotice({
        type: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível atualizar o registro na Cloudflare."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!recordToDelete) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiRequest<{ record: DnsRecord }>(`/api/records/${recordToDelete.id}`, {
        method: "DELETE"
      });
      setNotice({ type: "success", message: "Registro DNS excluído com sucesso." });
      setRecordToDelete(undefined);
      await reload();
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível excluir o registro DNS."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: TableColumn<DnsRecord>[] = [
    {
      header: "Tipo",
      cell: (record) => <Badge variant="info">{record.type}</Badge>
    },
    {
      header: "Nome/subdomínio",
      cell: (record) => (
        <div>
          <p className="font-medium text-zinc-950">{record.name}</p>
          <p className="mt-1 text-xs text-zinc-500">{domainById.get(record.domainId) ?? "Domínio removido"}</p>
        </div>
      )
    },
    {
      header: "Valor/conteúdo",
      cell: (record) => <span className="break-all">{formatRecordValue(record)}</span>
    },
    {
      header: "TTL",
      cell: (record) => formatTtl(record.ttl)
    },
    {
      header: "Proxy ativo",
      cell: (record) => <Badge variant={record.proxied ? "success" : "muted"}>{record.proxied ? "Sim" : "Não"}</Badge>
    },
    {
      header: "Origem",
      cell: (record) => (
        <Badge variant={record.source === "cloudflare" ? "info" : "muted"}>
          {record.source === "cloudflare" ? "Cloudflare" : "Manual"}
        </Badge>
      )
    },
    {
      header: "Última sincronização",
      cell: (record) => (record.lastSyncedAt ? formatDateTime(record.lastSyncedAt) : "-")
    },
    {
      header: "ID Cloudflare",
      cell: (record) => <span className="font-mono text-xs text-zinc-500">{formatCloudflareId(record.cloudflareRecordId)}</span>
    },
    {
      header: "Status",
      cell: (record) => <StatusBadge status={record.status} />
    },
    {
      header: "Criado em",
      cell: (record) => formatDate(record.createdAt)
    },
    {
      header: "Ações",
      className: "min-w-44",
      cell: (record) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openEditModal(record)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => setRecordToDelete(record)}
            className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Registros DNS</h2>
          <p className="mt-1 text-sm text-zinc-500">Controle persistido no PostgreSQL para registros A, AAAA, CNAME, TXT e MX.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">Todos os domínios</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCloudflareSync}
            disabled={isLoading || isSyncing || !syncDomain}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            {isSyncing ? "Sincronizando..." : "Sincronizar com Cloudflare"}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            Novo registro DNS
          </button>
        </div>
      </div>

      {notice ? <Notice type={notice.type} message={notice.message} /> : null}
      {syncDomain && !syncDomain.zoneId ? (
        <Notice type="info" message="Para sincronizar com Cloudflare, configure o Zone ID deste domínio." />
      ) : null}
      {isLoading ? <Notice type="info" message="Carregando registros DNS..." /> : null}

      <DataTable
        columns={columns}
        data={filteredRecords}
        emptyMessage="Nenhum registro DNS encontrado."
        getRowKey={(record) => record.id}
      />

      <Modal isOpen={isModalOpen} title={editingRecord ? "Editar registro DNS" : "Novo registro DNS"} onClose={closeModal} size="lg">
        <DnsRecordForm
          domains={domains}
          initialData={editingRecord}
          isSubmitting={isSubmitting}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingRecord ? "Salvar alterações" : "Criar registro"}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(recordToDelete)}
        title="Excluir registro DNS"
        message={`Deseja excluir ${recordToDelete ? `${recordToDelete.type} ${recordToDelete.name}` : "este registro"} do banco?`}
        warning={
          recordToDelete && isSensitiveRecord(recordToDelete)
            ? "Este registro parece sensível para funcionamento do domínio. Revise com atenção antes de excluir."
            : undefined
        }
        isConfirming={isSubmitting}
        onCancel={() => setRecordToDelete(undefined)}
        onConfirm={confirmDelete}
      />

      <Modal
        isOpen={Boolean(pendingCloudflareUpdate)}
        title="Confirmar alteração na Cloudflare"
        onClose={() => setPendingCloudflareUpdate(undefined)}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPendingCloudflareUpdate(undefined)}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmCloudflareUpdate()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Atualizando..." : "Confirmar alteração real na Cloudflare"}
            </button>
          </div>
        }
      >
        {pendingCloudflareUpdate ? (
          <div className="space-y-4 text-sm text-zinc-700">
            <p>Revise as alterações antes de aplicar na Cloudflare:</p>
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs">
              <div>
                <p className="mb-1 font-sans font-semibold text-zinc-900">Antes</p>
                <p>{formatRecordSummary(pendingCloudflareUpdate.record)}</p>
              </div>
              <div>
                <p className="mb-1 font-sans font-semibold text-zinc-900">Depois</p>
                <p>{buildSummaryFromInput(pendingCloudflareUpdate.input, pendingCloudflareUpdate.record)}</p>
              </div>
            </div>
            {isSensitiveRecord(pendingCloudflareUpdate.record) ? (
              <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Este registro parece sensível. Confirme apenas se tiver certeza da alteração.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
