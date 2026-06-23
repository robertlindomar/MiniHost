import { Archive } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { Project } from "@/lib/types";

interface ArchiveProjectDialogProps {
  project?: Project;
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchiveProjectDialog({
  project,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm
}: ArchiveProjectDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="Arquivar projeto"
      titleInfo="Os registros DNS vinculados serão mantidos. Apenas o status do projeto mudará para arquivado."
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
            className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Archive className="h-4 w-4" />
            {isSubmitting ? "Arquivando..." : "Arquivar projeto"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-zinc-600">
          Tem certeza que deseja arquivar o projeto{" "}
          <span className="font-semibold text-zinc-950">{project?.name ?? "selecionado"}</span>?
        </p>
        {project?.recordCount ? (
          <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este projeto possui {project.recordCount} registro(s) DNS vinculado(s). Eles permanecerão no sistema.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
