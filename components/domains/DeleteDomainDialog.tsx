import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { Domain } from "@/lib/types";

interface DeleteDomainDialogProps {
  domain?: Domain;
  associatedRecordsCount: number;
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDomainDialog({
  domain,
  associatedRecordsCount,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm
}: DeleteDomainDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="Excluir domínio"
      titleInfo={
        associatedRecordsCount > 0
          ? "Todos os registros DNS associados a este domínio também serão removidos do banco de dados."
          : undefined
      }
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
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Trash2 className="h-4 w-4" />
            {isSubmitting ? "Excluindo..." : "Excluir domínio"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-zinc-600">
          Tem certeza que deseja excluir o domínio{" "}
          <span className="font-semibold text-zinc-950">{domain?.name ?? "selecionado"}</span>?
        </p>
      </div>
    </Modal>
  );
}
