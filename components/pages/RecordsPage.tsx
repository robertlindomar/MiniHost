"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { formatDate, formatRecordValue, formatTtl } from "@/lib/format";
import type { DnsRecord, DnsRecordFormInput, Domain } from "@/lib/types";
import { isSensitiveRecord } from "@/lib/validation";

type NoticeState = { type: "success" | "error" | "info"; message: string } | null;
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };

export function RecordsPage() {
  const searchParams = useSearchParams();
  const domainFromUrl = searchParams.get("domain");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [domainFilter, setDomainFilter] = useState(domainFromUrl ?? "all");
  const [editingRecord, setEditingRecord] = useState<DnsRecord | undefined>();
  const [recordToDelete, setRecordToDelete] = useState<DnsRecord | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  async function handleSubmit(input: DnsRecordFormInput) {
    try {
      setIsSubmitting(true);

      if (editingRecord) {
        await apiRequest<{ record: DnsRecord }>(`/api/records/${editingRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: "Registro DNS editado com sucesso." });
      } else {
        await apiRequest<{ record: DnsRecord }>("/api/records", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: "Registro DNS criado com sucesso." });
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
          <p className="mt-1 text-sm text-zinc-500">Controle persistido no PostgreSQL para registros A, CNAME, TXT e MX.</p>
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
    </div>
  );
}
