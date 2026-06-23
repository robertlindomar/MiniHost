"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DnsRecordFormModal } from "@/components/records/DnsRecordFormModal";
import { DeleteRecordModal } from "@/components/forms/DeleteRecordModal";
import { CloudflareUpdateConfirmDialog } from "@/components/records/CloudflareUpdateConfirmDialog";
import { DnsRecordsTable, type RecordDisplayMode } from "@/components/records/DnsRecordsTable";
import type { RecordVisibilityFilter } from "@/components/records/RecordsFilters";
import { RecordsLoadingState } from "@/components/records/RecordsLoadingState";
import { RecordsPageHeader } from "@/components/records/RecordsPageHeader";
import { RecordsToolbar } from "@/components/records/RecordsToolbar";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import type { DnsRecord, DnsRecordFormInput, Domain } from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };
type CloudflareSyncResponse = { imported: number; updated: number; total: number; records: DnsRecord[] };
type CloudflareCreateRecordResponse = { message: string; record: DnsRecord };
type CloudflareUpdateRecordResponse = { message: string; record: DnsRecord };
type LocalUpdateRecordResponse = { message: string; record: DnsRecord };
type DeleteRecordResponse = { message: string; record: DnsRecord };

type PendingCloudflareUpdate = {
  record: DnsRecord;
  input: DnsRecordFormInput;
};

export function RecordsPage() {
  const searchParams = useSearchParams();
  const domainFromUrl = searchParams.get("domain");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [domainFilter, setDomainFilter] = useState(domainFromUrl ?? "all");
  const [visibilityFilter, setVisibilityFilter] = useState<RecordVisibilityFilter>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [displayMode, setDisplayMode] = useState<RecordDisplayMode>("compact");
  const [editingRecord, setEditingRecord] = useState<DnsRecord | undefined>();
  const [recordToDelete, setRecordToDelete] = useState<DnsRecord | undefined>();
  const [pendingCloudflareUpdate, setPendingCloudflareUpdate] = useState<PendingCloudflareUpdate | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  async function reload(visibility: RecordVisibilityFilter = visibilityFilter) {
    try {
      setIsLoading(true);
      const [domainData, recordData] = await Promise.all([
        apiRequest<DomainsResponse>("/api/domains"),
        apiRequest<RecordsResponse>(`/api/records?visibility=${visibility}`)
      ]);
      setDomains(domainData.domains);
      setRecords(recordData.records);
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Erro ao carregar registros DNS."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload(visibilityFilter);
  }, [visibilityFilter]);

  useEffect(() => {
    setDomainFilter(domainFromUrl ?? "all");
  }, [domainFromUrl]);

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

  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain])), [domains]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      if (domainFilter !== "all" && record.domainId !== domainFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const domainName = domainById.get(record.domainId)?.name ?? "";
      const fullName =
        record.name === "@" || record.name === ""
          ? domainName
          : record.name.endsWith(`.${domainName}`)
            ? record.name
            : `${record.name}.${domainName}`;

      return [
        record.type,
        record.name,
        record.value,
        record.comment ?? "",
        record.cloudflareRecordId ?? "",
        record.source,
        domainName,
        fullName
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [domainById, domainFilter, records, searchTerm]);

  const syncDomain = useMemo(() => {
    if (domainFilter !== "all") {
      return domains.find((domain) => domain.id === domainFilter);
    }

    return domains.length === 1 ? domains[0] : undefined;
  }, [domainFilter, domains]);

  const canSync = Boolean(syncDomain?.zoneId);
  const syncDisabledReason = useMemo(() => {
    if (canSync) {
      return undefined;
    }

    if (domainFilter === "all" || !syncDomain) {
      return "Selecione um domínio específico com Zone ID configurado para sincronizar com a Cloudflare.";
    }

    return "Este domínio não possui Zone ID na Cloudflare. Configure em Domínios ou Configurações para habilitar a sincronização.";
  }, [canSync, domainFilter, syncDomain]);
  const isFiltered = domainFilter !== "all" || visibilityFilter !== "active" || searchTerm.trim().length > 0;
  const pendingDomain = pendingCloudflareUpdate ? domainById.get(pendingCloudflareUpdate.record.domainId) : undefined;

  function openCreateModal() {
    if (domains.length === 0) {
      setToast({ type: "error", message: "Cadastre um domínio antes de criar registros DNS." });
      return;
    }

    setEditingRecord(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(record: DnsRecord) {
    if (record.status === "DELETED") {
      setToast({ type: "error", message: "Registros excluídos não podem ser editados." });
      return;
    }

    setEditingRecord(record);
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setEditingRecord(undefined);
  }

  async function handleCloudflareSync() {
    if (!syncDomain) {
      setToast({ type: "error", message: "Selecione um domínio para sincronizar com Cloudflare." });
      return;
    }

    if (!syncDomain.zoneId) {
      setToast({ type: "error", message: "Configure o Zone ID deste domínio antes de sincronizar." });
      return;
    }

    try {
      setIsSyncing(true);
      await apiRequest<CloudflareSyncResponse>("/api/cloudflare/sync-zone", {
        method: "POST",
        body: JSON.stringify({ domainId: syncDomain.id })
      });
      setToast({ type: "success", message: "Sincronização concluída com sucesso." });
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível sincronizar com a Cloudflare."
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSubmit(input: DnsRecordFormInput) {
    try {
      if (editingRecord?.cloudflareRecordId) {
        setPendingCloudflareUpdate({ record: editingRecord, input });
        setIsModalOpen(false);
        setEditingRecord(undefined);
        return;
      }

      setIsSubmitting(true);

      if (editingRecord) {
        await apiRequest<LocalUpdateRecordResponse>(`/api/records/${editingRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Registro atualizado com sucesso." });
      } else if (input.createInCloudflare) {
        await apiRequest<CloudflareCreateRecordResponse>("/api/cloudflare/create-record", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Registro criado na Cloudflare com sucesso." });
      } else {
        await apiRequest<{ record: DnsRecord }>("/api/records", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Registro criado com sucesso." });
      }

      setIsModalOpen(false);
      setEditingRecord(undefined);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar o registro."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickSave(record: DnsRecord, input: DnsRecordFormInput) {
    try {
      if (record.cloudflareRecordId) {
        setPendingCloudflareUpdate({ record, input });
        return;
      }

      await apiRequest<LocalUpdateRecordResponse>(`/api/records/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
      setToast({ type: "success", message: "Registro atualizado com sucesso." });
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar o registro."
      });
    }
  }

  function handleExport() {
    const headers = ["tipo", "nome", "dominio", "conteudo", "ttl", "proxy", "origem", "status", "cloudflareId"];
    const rows = filteredRecords.map((record) => {
      const domainName = domainById.get(record.domainId)?.name ?? "";

      return [
        record.type,
        record.name,
        domainName,
        record.value,
        String(record.ttl),
        record.proxied ? "sim" : "nao",
        record.source,
        record.status,
        record.cloudflareRecordId ?? ""
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "minihost-registros-dns.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function confirmCloudflareUpdate() {
    if (!pendingCloudflareUpdate) {
      return;
    }

    const { record, input } = pendingCloudflareUpdate;

    try {
      setIsSubmitting(true);
      await apiRequest<CloudflareUpdateRecordResponse>("/api/cloudflare/update-record", {
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
      setToast({ type: "success", message: "Registro atualizado na Cloudflare com sucesso." });
      setPendingCloudflareUpdate(undefined);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível atualizar na Cloudflare."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete(input: { confirmationText: string; reason: string }) {
    if (!recordToDelete) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (recordToDelete.cloudflareRecordId) {
        await apiRequest<DeleteRecordResponse>("/api/cloudflare/delete-record", {
          method: "DELETE",
          body: JSON.stringify({
            recordId: recordToDelete.id,
            confirmationText: input.confirmationText,
            reason: input.reason || undefined
          })
        });
        setToast({ type: "success", message: "Registro excluído com sucesso." });
      } else {
        await apiRequest<DeleteRecordResponse>(`/api/records/${recordToDelete.id}`, {
          method: "DELETE",
          body: JSON.stringify({
            confirmationText: input.confirmationText,
            reason: input.reason || undefined
          })
        });
        setToast({ type: "success", message: "Registro marcado como excluído." });
      }

      setRecordToDelete(undefined);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível excluir o registro."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <RecordsPageHeader
        isLoading={isLoading}
        isSyncing={isSyncing}
        canSync={canSync}
        syncDisabledReason={syncDisabledReason}
        onSync={handleCloudflareSync}
      />

      <RecordsToolbar
        searchTerm={searchTerm}
        visibilityFilter={visibilityFilter}
        domainFilter={domainFilter}
        displayMode={displayMode}
        domains={domains}
        isLoading={isLoading}
        onSearchChange={setSearchTerm}
        onVisibilityChange={setVisibilityFilter}
        onDomainChange={setDomainFilter}
        onDisplayModeChange={setDisplayMode}
        onExport={handleExport}
        onCreate={openCreateModal}
      />

      {isLoading ? (
        <RecordsLoadingState />
      ) : (
        <DnsRecordsTable
          records={filteredRecords}
          domains={domains}
          totalRecords={records.length}
          displayMode={displayMode}
          isFiltered={isFiltered}
          canSync={canSync}
          onCreate={openCreateModal}
          onSync={handleCloudflareSync}
          onQuickSave={handleQuickSave}
          onDelete={setRecordToDelete}
        />
      )}

      <DnsRecordFormModal
        isOpen={isModalOpen}
        domains={domains}
        initialData={editingRecord}
        isSubmitting={isSubmitting}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <DeleteRecordModal
        isOpen={Boolean(recordToDelete)}
        record={recordToDelete}
        domainName={recordToDelete ? domainById.get(recordToDelete.domainId)?.name : undefined}
        isSubmitting={isSubmitting}
        onCancel={() => (isSubmitting ? undefined : setRecordToDelete(undefined))}
        onConfirm={confirmDelete}
      />

      <CloudflareUpdateConfirmDialog
        record={pendingCloudflareUpdate?.record}
        input={pendingCloudflareUpdate?.input}
        domain={pendingDomain}
        isSubmitting={isSubmitting}
        onCancel={() => (isSubmitting ? undefined : setPendingCloudflareUpdate(undefined))}
        onConfirm={() => void confirmCloudflareUpdate()}
      />
    </div>
  );
}
