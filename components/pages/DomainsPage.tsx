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
import { formatDate } from "@/lib/format";
import {
  addHistoryItem,
  createId,
  initializeMiniHostStorage,
  loadDomains,
  loadRecords,
  saveDomains,
  saveRecords
} from "@/lib/storage";
import type { Domain, DomainFormInput, DnsRecord } from "@/lib/types";

type NoticeState = { type: "success" | "error" | "info"; message: string } | null;

export function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [editingDomain, setEditingDomain] = useState<Domain | undefined>();
  const [domainToDelete, setDomainToDelete] = useState<Domain | undefined>();
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

  function handleSubmit(input: DomainFormInput) {
    const duplicated = domains.some((domain) => domain.name === input.name && domain.id !== editingDomain?.id);

    if (duplicated) {
      setNotice({ type: "error", message: "Já existe um domínio com esse nome." });
      return;
    }

    const now = new Date().toISOString();

    if (editingDomain) {
      const nextDomains = domains.map((domain) =>
        domain.id === editingDomain.id
          ? {
              ...domain,
              ...input,
              updatedAt: now
            }
          : domain
      );

      saveDomains(nextDomains);
      addHistoryItem({
        action: "Domínio editado",
        entityType: "domain",
        entityName: input.name,
        description: `Domínio ${input.name} atualizado no painel local.`
      });
      setNotice({ type: "success", message: "Domínio editado com sucesso." });
    } else {
      const nextDomain: Domain = {
        id: createId("domain"),
        ...input,
        createdAt: now,
        updatedAt: now
      };

      saveDomains([nextDomain, ...domains]);
      addHistoryItem({
        action: "Domínio criado",
        entityType: "domain",
        entityName: nextDomain.name,
        description: `Domínio ${nextDomain.name} cadastrado no painel local.`
      });
      setNotice({ type: "success", message: "Domínio criado com sucesso." });
    }

    closeModal();
    reload();
  }

  function confirmDelete() {
    if (!domainToDelete) {
      return;
    }

    const affectedRecords = records.filter((record) => record.domainId === domainToDelete.id);
    const nextDomains = domains.filter((domain) => domain.id !== domainToDelete.id);
    const nextRecords = records.filter((record) => record.domainId !== domainToDelete.id);

    saveDomains(nextDomains);
    saveRecords(nextRecords);
    addHistoryItem({
      action: "Domínio excluído",
      entityType: "domain",
      entityName: domainToDelete.name,
      description:
        affectedRecords.length > 0
          ? `Domínio ${domainToDelete.name} excluído localmente com ${affectedRecords.length} registro(s) associado(s).`
          : `Domínio ${domainToDelete.name} excluído localmente.`
    });

    setNotice({ type: "success", message: "Domínio excluído com sucesso." });
    setDomainToDelete(undefined);
    reload();
  }

  const columns: TableColumn<Domain>[] = [
    {
      header: "Domínio",
      cell: (domain) => (
        <div>
          <p className="font-medium text-zinc-950">{domain.name}</p>
          {domain.zoneId ? <p className="mt-1 text-xs text-zinc-500">{domain.zoneId}</p> : null}
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
          <p className="mt-1 text-sm text-zinc-500">Dados persistidos localmente neste navegador.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          Novo domínio
        </button>
      </div>

      {notice ? <Notice type={notice.type} message={notice.message} /> : null}

      <DataTable columns={columns} data={domains} emptyMessage="Nenhum domínio cadastrado." getRowKey={(domain) => domain.id} />

      <Modal isOpen={isModalOpen} title={editingDomain ? "Editar domínio" : "Novo domínio"} onClose={closeModal}>
        <DomainForm
          initialData={editingDomain}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingDomain ? "Salvar alterações" : "Criar domínio"}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(domainToDelete)}
        title="Excluir domínio"
        message={`Deseja excluir ${domainToDelete?.name ?? "este domínio"} do painel local?`}
        warning={
          records.some((record) => record.domainId === domainToDelete?.id)
            ? "Os registros DNS locais associados a este domínio também serão removidos."
            : undefined
        }
        onCancel={() => setDomainToDelete(undefined)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
