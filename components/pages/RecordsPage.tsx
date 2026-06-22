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
import { formatDate, formatRecordValue, formatTtl } from "@/lib/format";
import {
  addHistoryItem,
  createId,
  initializeMiniHostStorage,
  loadDomains,
  loadRecords,
  saveRecords
} from "@/lib/storage";
import type { DnsRecord, DnsRecordFormInput, Domain } from "@/lib/types";
import { isSensitiveRecord } from "@/lib/validation";

type NoticeState = { type: "success" | "error" | "info"; message: string } | null;

export function RecordsPage() {
  const searchParams = useSearchParams();
  const domainFromUrl = searchParams.get("domain");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [domainFilter, setDomainFilter] = useState(domainFromUrl ?? "all");
  const [editingRecord, setEditingRecord] = useState<DnsRecord | undefined>();
  const [recordToDelete, setRecordToDelete] = useState<DnsRecord | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  function reload() {
    setDomains(loadDomains());
    setRecords(loadRecords());
  }

  useEffect(() => {
    initializeMiniHostStorage();
    reload();
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

  function handleSubmit(input: DnsRecordFormInput) {
    const now = new Date().toISOString();
    const domainName = domainById.get(input.domainId) ?? "Domínio removido";

    if (editingRecord) {
      const nextRecords = records.map((record) =>
        record.id === editingRecord.id
          ? {
              ...record,
              ...input,
              updatedAt: now
            }
          : record
      );

      saveRecords(nextRecords);
      addHistoryItem({
        action: "Registro editado",
        entityType: "record",
        entityName: `${input.type} ${input.name}`,
        description: `Registro ${input.type} ${input.name} atualizado em ${domainName}.`
      });
      setNotice({ type: "success", message: "Registro DNS editado com sucesso." });
    } else {
      const nextRecord: DnsRecord = {
        id: createId("record"),
        ...input,
        createdAt: now,
        updatedAt: now
      };

      saveRecords([nextRecord, ...records]);
      addHistoryItem({
        action: "Registro criado",
        entityType: "record",
        entityName: `${nextRecord.type} ${nextRecord.name}`,
        description: `Registro ${nextRecord.type} ${nextRecord.name} criado em ${domainName}.`
      });
      setNotice({ type: "success", message: "Registro DNS criado com sucesso." });
    }

    closeModal();
    reload();
  }

  function confirmDelete() {
    if (!recordToDelete) {
      return;
    }

    const domainName = domainById.get(recordToDelete.domainId) ?? "Domínio removido";
    const nextRecords = records.filter((record) => record.id !== recordToDelete.id);

    saveRecords(nextRecords);
    addHistoryItem({
      action: "Registro excluído",
      entityType: "record",
      entityName: `${recordToDelete.type} ${recordToDelete.name}`,
      description: `Registro ${recordToDelete.type} ${recordToDelete.name} excluído de ${domainName}.`
    });
    setNotice({ type: "success", message: "Registro DNS excluído com sucesso." });
    setRecordToDelete(undefined);
    reload();
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
          <p className="mt-1 text-sm text-zinc-500">Controle visual local para registros A, CNAME, TXT e MX.</p>
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
            className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Novo registro DNS
          </button>
        </div>
      </div>

      {notice ? <Notice type={notice.type} message={notice.message} /> : null}

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
          onCancel={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingRecord ? "Salvar alterações" : "Criar registro"}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(recordToDelete)}
        title="Excluir registro DNS"
        message={`Deseja excluir ${recordToDelete ? `${recordToDelete.type} ${recordToDelete.name}` : "este registro"} do painel local?`}
        warning={
          recordToDelete && isSensitiveRecord(recordToDelete)
            ? "Este registro parece sensível para funcionamento do domínio. Revise com atenção antes de excluir."
            : undefined
        }
        onCancel={() => setRecordToDelete(undefined)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
