"use client";

import { useEffect, useMemo, useState } from "react";
import { DeleteDomainDialog } from "@/components/domains/DeleteDomainDialog";
import { DomainTable, type DomainStatusFilter } from "@/components/domains/DomainTable";
import { DomainsLoadingState } from "@/components/domains/DomainsLoadingState";
import { DomainsPageHeader } from "@/components/domains/DomainsPageHeader";
import { DomainForm } from "@/components/forms/DomainForm";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import type { Domain, DomainFormInput, DnsRecord } from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };

export function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [editingDomain, setEditingDomain] = useState<Domain | undefined>();
  const [domainToDelete, setDomainToDelete] = useState<Domain | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DomainStatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

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
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Erro ao carregar domínios."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(
      () => setToast(null),
      toast.type === "error" ? 6500 : 4200
    );

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredDomains = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return domains.filter((domain) => {
      const matchesStatus = statusFilter === "all" || domain.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        domain.name.toLowerCase().includes(normalizedSearch) ||
        domain.provider.toLowerCase().includes(normalizedSearch) ||
        (domain.zoneId ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [domains, searchTerm, statusFilter]);

  const recordsByDomain = useMemo(() => {
    const map = new Map<string, number>();

    records.forEach((record) => {
      map.set(record.domainId, (map.get(record.domainId) ?? 0) + 1);
    });

    return map;
  }, [records]);

  function openCreateModal() {
    setEditingDomain(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(domain: Domain) {
    setEditingDomain(domain);
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setEditingDomain(undefined);
  }

  async function handleSubmit(input: DomainFormInput) {
    const duplicated = domains.some((domain) => domain.name === input.name && domain.id !== editingDomain?.id);

    if (duplicated) {
      setToast({ type: "error", message: "Já existe um domínio com esse nome." });
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingDomain) {
        await apiRequest<{ domain: Domain }>(`/api/domains/${editingDomain.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Domínio atualizado com sucesso." });
      } else {
        await apiRequest<{ domain: Domain }>("/api/domains", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Domínio criado com sucesso." });
      }

      setIsModalOpen(false);
      setEditingDomain(undefined);
      await reload();
    } catch (requestError) {
      setToast({
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
      setToast({ type: "success", message: "Domínio excluído com sucesso." });
      setDomainToDelete(undefined);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível excluir o domínio."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <DomainsPageHeader onCreate={openCreateModal} disabled={isLoading} />

      {isLoading ? (
        <DomainsLoadingState />
      ) : (
        <DomainTable
          domains={filteredDomains}
          totalDomains={domains.length}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          isLoading={isLoading}
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onCreate={openCreateModal}
          onEdit={openEditModal}
          onDelete={setDomainToDelete}
        />
      )}

      <Modal isOpen={isModalOpen} title={editingDomain ? "Editar domínio" : "Novo domínio"} onClose={closeModal}>
        <DomainForm
          initialData={editingDomain}
          isSubmitting={isSubmitting}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingDomain ? "Salvar alterações" : "Criar domínio"}
        />
      </Modal>

      <DeleteDomainDialog
        isOpen={Boolean(domainToDelete)}
        domain={domainToDelete}
        associatedRecordsCount={domainToDelete ? recordsByDomain.get(domainToDelete.id) ?? 0 : 0}
        isSubmitting={isSubmitting}
        onCancel={() => (isSubmitting ? undefined : setDomainToDelete(undefined))}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
