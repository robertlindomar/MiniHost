"use client";

import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import type { DnsRecord, Domain } from "@/lib/types";

interface LinkRecordsDialogProps {
  isOpen: boolean;
  isSubmitting?: boolean;
  records: DnsRecord[];
  domains: Domain[];
  linkedRecordIds: string[];
  onCancel: () => void;
  onConfirm: (recordIds: string[]) => void;
}

function getFullRecordName(record: DnsRecord, domains: Domain[]) {
  const domainName = domains.find((domain) => domain.id === record.domainId)?.name ?? "";

  if (!record.name || record.name === "@") {
    return domainName;
  }

  if (record.name.endsWith(`.${domainName}`)) {
    return record.name;
  }

  return `${record.name}.${domainName}`;
}

export function LinkRecordsDialog({
  isOpen,
  isSubmitting = false,
  records,
  domains,
  linkedRecordIds,
  onCancel,
  onConfirm
}: LinkRecordsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const availableRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      if (linkedRecordIds.includes(record.id)) {
        return false;
      }

      if (record.projectId) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const fullName = getFullRecordName(record, domains).toLowerCase();

      return [fullName, record.type, record.value, record.comment ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [domains, linkedRecordIds, records, searchTerm]);

  function toggleRecord(recordId: string) {
    setSelectedIds((current) =>
      current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]
    );
  }

  function handleConfirm() {
    if (selectedIds.length === 0) {
      return;
    }

    onConfirm(selectedIds);
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Vincular registros DNS"
      titleInfo="Selecione registros existentes sem projeto para vincular a este projeto."
      onClose={onCancel}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || selectedIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Link2 className="h-4 w-4" />
            {isSubmitting ? "Vinculando..." : `Vincular ao projeto (${selectedIds.length})`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar registros DNS..."
          className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        {availableRecords.length === 0 ? (
          <Notice
            type="info"
            message="Não há registros disponíveis para vincular. Apenas registros ativos sem projeto aparecem aqui."
          />
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-2">
            {availableRecords.map((record) => {
              const fullName = getFullRecordName(record, domains);
              const isSelected = selectedIds.includes(record.id);

              return (
                <label
                  key={record.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition ${
                    isSelected ? "border-blue-200 bg-blue-50" : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecord(record.id)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-zinc-950">{fullName}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {record.type} · {record.value}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
