import { Modal } from "@/components/ui/Modal";
import type { ProjectDatabase } from "@/lib/types";

interface ArchiveProjectDatabaseDialogProps {
  database?: ProjectDatabase;
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchiveProjectDatabaseDialog({
  database,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm
}: ArchiveProjectDatabaseDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="Arquivar banco PostgreSQL"
      titleInfo="O banco planejado será arquivado, mas as credenciais permanecem salvas criptografadas."
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
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Arquivando..." : "Arquivar banco"}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-zinc-600">
        Tem certeza que deseja arquivar o banco{" "}
        <span className="font-semibold text-zinc-950">{database?.name ?? "selecionado"}</span>?
      </p>
    </Modal>
  );
}
