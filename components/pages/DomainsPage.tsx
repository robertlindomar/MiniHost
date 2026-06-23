"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DomainForm } from "@/components/forms/DomainForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Domain, DomainFormInput, DnsRecord } from "@/lib/types";

type NoticeState = { type: "success" | "error" | "info"; message: string } | null;
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };

export function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [editingDomain, setEditingDomain] = useState<Domain | undefined>();
  const [domainToDelete, setDomainToDelete] = useState<Domain | undefined>();
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
        message: requestError instanceof Error ? requestError.message : "Não foi possível carregar os domínios."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function openCreateModal() {
    setEditingDomain(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(domain: Domain) {
    setEditingDomain(domain);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingDomain(undefined);
  }

  async function handleSubmit(input: DomainFormInput) {
    const duplicated = domains.some((domain) => domain.name === input.name && domain.id !== editingDomain?.id);

    if (duplicated) {
      setNotice({ type: "error", message: "Já existe um domínio com esse nome." });
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingDomain) {
        await apiRequest<{ domain: Domain }>(`/api/domains/${editingDomain.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: "Domínio editado com sucesso." });
      } else {
        await apiRequest<{ domain: Domain }>("/api/domains", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setNotice({ type: "success", message: "Domínio criado com sucesso." });
      }

      closeModal();
      await reload();
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar o domínio."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!domainToDelete) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiRequest<{ domain: Domain }>(`/api/domains/${domainToDelete.id}`, {
        method: "DELETE"
      });
      setNotice({ type: "success", message: "Domínio excluído com sucesso." });
      setDomainToDelete(undefined);
      await reload();
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível excluir o domínio."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: TableColumn<Domain>[] = [
    {
      header: "Domínio",
      cell: (domain) => (
        <div>
          <p className="font-medium text-zinc-950">{domain.name}</p>
          {domain.zoneId ? (
            <p className="mt-1 text-xs text-zinc-500">{domain.zoneId}</p>
          ) : (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Para sincronizar com Cloudflare, configure o Zone ID deste domínio.
            </p>
          )}
        </div>
      )
    },
    {
      header: "Provedor",
      cell: (domain) => domain.provider
    },
    {
      header: "Status",
      cell: (domain) => <StatusBadge status={domain.status} />
    },
    {
      header: "Criado em",
      cell: (domain) => formatDate(domain.createdAt)
    },
    {
      header: "Ações",
      className: "min-w-72",
      cell: (domain) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/records?domain=${domain.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver registros
          </Link>
          <button
            type="button"
            onClick={() => openEditModal(domain)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => setDomainToDelete(domain)}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Domínios cadastrados</h2>
          <p className="mt-1 text-sm text-zinc-500">Dados persistidos no PostgreSQL.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Plus className="h-4 w-4" />
          Novo domínio
        </button>
      </div>

      {notice ? <Notice type={notice.type} message={notice.message} /> : null}
      {isLoading ? <Notice type="info" message="Carregando domínios..." /> : null}

      <DataTable columns={columns} data={domains} emptyMessage="Nenhum domínio cadastrado." getRowKey={(domain) => domain.id} />

      <Modal isOpen={isModalOpen} title={editingDomain ? "Editar domínio" : "Novo domínio"} onClose={closeModal}>
        <DomainForm
          initialData={editingDomain}
          isSubmitting={isSubmitting}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingDomain ? "Salvar alterações" : "Criar domínio"}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(domainToDelete)}
        title="Excluir domínio"
        message={`Deseja excluir ${domainToDelete?.name ?? "este domínio"} do banco?`}
        warning={
          records.some((record) => record.domainId === domainToDelete?.id)
            ? "Os registros DNS associados a este domínio também serão removidos do banco."
            : undefined
        }
        isConfirming={isSubmitting}
        onCancel={() => setDomainToDelete(undefined)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
