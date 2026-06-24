"use client";

import { AlertTriangle, Archive, RotateCcw, Skull } from "lucide-react";
import { useState } from "react";
import { ArchiveProjectDialog } from "@/components/projects/ArchiveProjectDialog";
import { TerminateProjectModal } from "@/components/projects/TerminateProjectModal";
import { apiRequest } from "@/lib/api-client";
import type { ProjectTerminateResult } from "@/lib/terminate";
import type { Project } from "@/lib/types";

interface ProjectDangerZoneProps {
  project: Project;
  onChanged: () => Promise<void> | void;
  onToast: (toast: { type: "success" | "error" | "info"; message: string }) => void;
}

export function ProjectDangerZone({ project, onChanged, onToast }: ProjectDangerZoneProps) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);
  const [isRetryOpen, setIsRetryOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const isProtectedSlug = project.slug.trim().toLowerCase() === "minihost";
  const isTerminated =
    project.status === "TERMINATED" ||
    project.status === "TERMINATED_WITH_ERRORS" ||
    project.status === "TERMINATING";
  const isArchived = project.status === "ARCHIVED";
  const hasPending = (project.terminationPending?.length ?? 0) > 0;
  const canArchive = !isArchived && !isTerminated && !isProtectedSlug;
  const canTerminate = !isProtectedSlug && project.status !== "TERMINATING";

  async function handleArchive() {
    try {
      setIsArchiving(true);
      await apiRequest(`/api/projects/${project.id}/archive`, { method: "POST" });
      onToast({ type: "success", message: "Projeto arquivado com sucesso." });
      setIsArchiveOpen(false);
      await onChanged();
    } catch (error) {
      onToast({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível arquivar o projeto."
      });
    } finally {
      setIsArchiving(false);
    }
  }

  function handleTerminateCompleted(result: ProjectTerminateResult) {
    void onChanged();

    if (result.partial) {
      onToast({ type: "info", message: result.message });
      return;
    }

    onToast({ type: "success", message: result.message });
  }

  return (
    <>
      <section className="rounded-lg border border-rose-200 bg-rose-50/60 p-5 shadow-soft">
        <div className="flex items-start gap-3 border-b border-rose-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-rose-950">Zona de perigo</h3>
            <p className="mt-1 text-sm leading-6 text-rose-900/80">
              Encerrar projeto remove recursos reais vinculados, como DNS e aplicações no Coolify. Essa ação pode
              derrubar sites em produção. Arquivar é seguro e apenas altera o status local.
            </p>
          </div>
        </div>

        {isProtectedSlug ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800">
            Este projeto é protegido e não pode ser arquivado ou encerrado pelo MiniHost.
          </p>
        ) : null}

        {hasPending ? (
          <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">Pendências do último encerramento</p>
            <ul className="space-y-2">
              {project.terminationPending?.map((item) => (
                <li key={`${item.type}-${item.id}`} className="rounded-md bg-white px-3 py-2 text-sm">
                  <span className="font-medium text-zinc-900">{item.label ?? item.id}</span>
                  <span className="block text-rose-700">{item.error}</span>
                </li>
              ))}
            </ul>
            {canTerminate ? (
              <button
                type="button"
                onClick={() => setIsRetryOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
              >
                <RotateCcw className="h-4 w-4" />
                Tentar novamente pendências
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {canArchive ? (
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
            >
              <Archive className="h-4 w-4" />
              Arquivar projeto
            </button>
          ) : null}

          {canTerminate ? (
            <button
              type="button"
              onClick={() => setIsTerminateOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              <Skull className="h-4 w-4" />
              Encerrar projeto e infraestrutura
            </button>
          ) : null}
        </div>
      </section>

      <ArchiveProjectDialog
        project={project}
        isOpen={isArchiveOpen}
        isSubmitting={isArchiving}
        onCancel={() => (isArchiving ? undefined : setIsArchiveOpen(false))}
        onConfirm={() => void handleArchive()}
      />

      <TerminateProjectModal
        project={project}
        isOpen={isTerminateOpen}
        onClose={() => setIsTerminateOpen(false)}
        onCompleted={handleTerminateCompleted}
      />

      <TerminateProjectModal
        project={project}
        isOpen={isRetryOpen}
        retryPendingOnly
        onClose={() => setIsRetryOpen(false)}
        onCompleted={handleTerminateCompleted}
      />
    </>
  );
}
