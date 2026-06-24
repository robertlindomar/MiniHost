"use client";

import { Link2, Rocket, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { CoolifyProjectCache, Project, ProjectCoolifyInconsistencyReport } from "@/lib/types";

type CoolifyInconsistencyReport = ProjectCoolifyInconsistencyReport;

interface ProjectCoolifySectionProps {
  project: Project;
  coolifyProjects: CoolifyProjectCache[];
  inconsistencies?: CoolifyInconsistencyReport | null;
  isReadOnly: boolean;
  onChanged: () => Promise<void> | void;
  onToast: (toast: { type: "success" | "error" | "info"; message: string }) => void;
}

function sourceLabel(source?: string) {
  if (source === "PUBLISH") return "Publicar";
  if (source === "MANUAL_LINK") return "Manual";
  if (source === "BACKFILL") return "Backfill";
  if (source === "IMPORT") return "Importado";
  return source ?? "—";
}

export function ProjectCoolifySection({
  project,
  coolifyProjects,
  inconsistencies,
  isReadOnly,
  onChanged,
  onToast
}: ProjectCoolifySectionProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(project.coolifyLink?.coolifyProject?.id ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const linkedProject = project.coolifyLink?.coolifyProject;
  const activeCoolifyProjects = useMemo(
    () => coolifyProjects.filter((item) => item.status === "ACTIVE"),
    [coolifyProjects]
  );

  const statusBadge = inconsistencies?.hasInconsistency ? (
    <Badge variant="warning">Inconsistente</Badge>
  ) : linkedProject ? (
    <Badge variant="success">Vinculado</Badge>
  ) : (
    <Badge variant="muted">Sem projeto Coolify</Badge>
  );

  async function handleLinkProject() {
    if (!selectedProjectId) {
      onToast({ type: "error", message: "Selecione um projeto Coolify." });
      return;
    }

    try {
      setIsSaving(true);
      await apiRequest(`/api/projects/${project.id}/coolify-link`, {
        method: "POST",
        body: JSON.stringify({ coolifyProjectId: selectedProjectId })
      });
      onToast({ type: "success", message: "Projeto Coolify vinculado com sucesso." });
      await onChanged();
    } catch (error) {
      onToast({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível vincular o projeto Coolify."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlink() {
    try {
      setIsSaving(true);
      await apiRequest(`/api/projects/${project.id}/coolify-link`, { method: "DELETE" });
      onToast({ type: "success", message: "Vínculo local removido." });
      await onChanged();
    } catch (error) {
      onToast({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível remover o vínculo."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBackfill() {
    try {
      setIsFixing(true);
      const result = await apiRequest<{ message: string }>(`/api/projects/${project.id}/coolify-project`, {
        method: "POST"
      });
      onToast({ type: "success", message: result.message });
      await onChanged();
    } catch (error) {
      onToast({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível executar o backfill."
      });
    } finally {
      setIsFixing(false);
    }
  }

  async function handleFix(strategy: "from_project_link" | "from_first_app" | "clear_broken_link") {
    try {
      setIsFixing(true);
      const result = await apiRequest<{ message: string }>(`/api/projects/${project.id}/coolify-project/fix`, {
        method: "POST",
        body: JSON.stringify({ strategy })
      });
      onToast({ type: "success", message: result.message });
      await onChanged();
    } catch (error) {
      onToast({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível corrigir a inconsistência."
      });
    } finally {
      setIsFixing(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Projeto Coolify deste projeto</h3>
            <p className="mt-1 text-sm text-zinc-500">
              O projeto Coolify é o container deste projeto MiniHost. Aplicações, DNS e bancos pertencem ao projeto
              MiniHost; as apps são criadas dentro deste projeto Coolify.
            </p>
          </div>
        </div>
        {statusBadge}
      </div>

      {inconsistencies?.hasInconsistency ? (
        <div className="mt-5 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Inconsistência Coolify detectada</p>
          <ul className="space-y-2 text-sm text-amber-900">
            {inconsistencies.items.map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
          {!isReadOnly ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isFixing}
                onClick={() => void handleBackfill()}
                className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-70"
              >
                <Wrench className="h-4 w-4" />
                Tentar backfill
              </button>
              {project.coolifyLink?.coolifyProject ? (
                <button
                  type="button"
                  disabled={isFixing}
                  onClick={() => void handleFix("from_project_link")}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-70"
                >
                  Corrigir usando projeto Coolify do vínculo
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isFixing}
                  onClick={() => void handleFix("from_first_app")}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-70"
                >
                  Corrigir usando primeira aplicação
                </button>
              )}
              <button
                type="button"
                disabled={isFixing}
                onClick={() => void handleFix("clear_broken_link")}
                className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-70"
              >
                Remover vínculos locais quebrados
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {linkedProject ? (
        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Projeto Coolify vinculado</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{linkedProject.name}</p>
          <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
            <p>UUID: {linkedProject.coolifyId}</p>
            <p>Origem: {sourceLabel(project.coolifyLink?.source)}</p>
            <p>Criado pelo MiniHost: {project.coolifyLink?.createdByMiniHost ? "Sim" : "Não"}</p>
            <p>Estado local: {linkedProject.status}</p>
            <p>Status remoto: {linkedProject.remoteStatus || "—"}</p>
            <p>Última sincronização: {linkedProject.lastSyncedAt ? formatDateTime(linkedProject.lastSyncedAt) : "—"}</p>
          </div>
          {linkedProject.status === "MISSING" || linkedProject.status === "REMOVED" ? (
            <div className="mt-4">
              <Notice
                type="error"
                message="O projeto Coolify vinculado parece ausente ou removido. Sincronize novamente ou corrija o vínculo."
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5">
          <Notice
            type="info"
            message="Este projeto MiniHost ainda não possui um projeto Coolify vinculado. Crie ou vincule um antes de provisionar aplicações."
          />
        </div>
      )}

      {!isReadOnly ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Vincular projeto Coolify existente</span>
            <select
              value={selectedProjectId}
              disabled={isSaving || Boolean(linkedProject)}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50"
            >
              <option value="">Selecione um projeto Coolify</option>
              {activeCoolifyProjects.map((coolifyProject) => (
                <option key={coolifyProject.id} value={coolifyProject.id}>
                  {coolifyProject.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            {!linkedProject ? (
              <button
                type="button"
                onClick={() => void handleLinkProject()}
                disabled={isSaving || !selectedProjectId}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Link2 className="h-4 w-4" />
                {isSaving ? "Vinculando..." : "Vincular projeto Coolify"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleUnlink()}
                disabled={isSaving}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Remover vínculo local
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
