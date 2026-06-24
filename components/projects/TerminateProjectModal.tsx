"use client";

import { AlertTriangle, Skull } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { TerminationChecklist } from "@/components/projects/TerminationChecklist";
import { apiRequest } from "@/lib/api-client";
import {
  buildProjectTerminateConfirmationText,
  type ProjectTerminateResult,
  type TerminateOptions
} from "@/lib/terminate";
import type { Project, TerminationPendingItem } from "@/lib/types";

type TerminatePreviewResponse = {
  project: { id: string; name: string; slug: string; status: string };
  confirmationText: string;
  defaults: TerminateOptions;
  resources: {
    dnsRecords: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      cloudflareRecordId?: string | null;
      domainName: string;
    }>;
    applications: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      hasCoolify: boolean;
      coolifyApplicationName?: string;
      coolifyProjectName?: string;
    }>;
    coolifyProjects: Array<{
      id: string;
      name: string;
      status: string;
      createdByMiniHost: boolean;
    }>;
    databases: Array<{
      id: string;
      name: string;
      databaseName: string;
      databaseUser: string;
      status: string;
    }>;
  };
  pending: TerminationPendingItem[];
};

interface TerminateProjectModalProps {
  project: Project;
  isOpen: boolean;
  retryPendingOnly?: boolean;
  onClose: () => void;
  onCompleted: (result: ProjectTerminateResult) => void;
}

export function TerminateProjectModal({
  project,
  isOpen,
  retryPendingOnly = false,
  onClose,
  onCompleted
}: TerminateProjectModalProps) {
  const [preview, setPreview] = useState<TerminatePreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"confirm" | "result">("confirm");
  const [result, setResult] = useState<ProjectTerminateResult | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [understandRisk, setUnderstandRisk] = useState(false);
  const [options, setOptions] = useState<TerminateOptions>({
    archiveProject: true,
    deleteDnsRecords: true,
    deleteCoolifyApplications: true,
    deleteCoolifyProject: true,
    destroyDatabases: false,
    confirmExternalCoolifyRemoval: false
  });

  const expectedConfirmation = buildProjectTerminateConfirmationText(project.slug);
  const confirmationValid = confirmationText.trim().toLowerCase() === expectedConfirmation;

  const coolifyProjects = preview?.resources.coolifyProjects ?? [];
  const externalCoolifyProjects = coolifyProjects.filter((item) => !item.createdByMiniHost);
  const coolifyProjectNames = coolifyProjects.map((item) => item.name).join(", ");

  const canSubmit = useMemo(() => {
    if (!confirmationValid || !understandRisk || isSubmitting) {
      return false;
    }

    if (
      options.deleteCoolifyProject &&
      externalCoolifyProjects.length > 0 &&
      !options.confirmExternalCoolifyRemoval
    ) {
      return false;
    }

    return true;
  }, [
    confirmationValid,
    understandRisk,
    isSubmitting,
    options.deleteCoolifyProject,
    options.confirmExternalCoolifyRemoval,
    externalCoolifyProjects.length
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPhase("confirm");
    setResult(null);
    setError(null);
    setConfirmationText("");
    setUnderstandRisk(false);

    async function loadPreview() {
      try {
        setIsLoadingPreview(true);
        const data = await apiRequest<TerminatePreviewResponse>(`/api/projects/${project.id}/terminate-preview`);
        setPreview(data);

        if (retryPendingOnly && data.pending.length > 0) {
          setOptions({
            archiveProject: false,
            deleteDnsRecords: data.pending.some((item) => item.type === "dns"),
            deleteCoolifyApplications: data.pending.some((item) => item.type === "coolify_app"),
            deleteCoolifyProject: data.pending.some((item) => item.type === "coolify_project"),
            destroyDatabases: data.pending.some((item) => item.type === "database"),
            confirmExternalCoolifyRemoval: data.pending.some(
              (item) =>
                item.type === "coolify_project" &&
                item.error.toLowerCase().includes("não foi criado pelo minihost")
            )
          });
        } else {
          setOptions({
            ...data.defaults,
            confirmExternalCoolifyRemoval: false
          });
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o preview.");
      } finally {
        setIsLoadingPreview(false);
      }
    }

    void loadPreview();
  }, [isOpen, project.id]);

  async function handleSubmit() {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await apiRequest<ProjectTerminateResult>("/api/projects/terminate", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          confirmationText,
          understandRisk,
          retryPendingOnly,
          options
        })
      });

      setResult(response);
      setPhase("result");
      onCompleted(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível encerrar o projeto.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = retryPendingOnly ? "Tentar novamente pendências" : "Encerrar projeto e infraestrutura";

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      titleInfo="Encerrar projeto remove recursos reais vinculados, como DNS e aplicações no Coolify. Essa ação pode derrubar sites em produção."
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      size="lg"
      footer={
        phase === "confirm" ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isLoadingPreview}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Skull className="h-4 w-4" />
              {isSubmitting ? "Encerrando..." : retryPendingOnly ? "Tentar novamente" : "Encerrar projeto"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Fechar
            </button>
          </div>
        )
      }
    >
      {phase === "confirm" ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
          ) : null}

          {isLoadingPreview ? (
            <p className="text-sm text-zinc-600">Carregando recursos vinculados...</p>
          ) : preview ? (
            <>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                  <div className="space-y-2 text-sm text-rose-900">
                    <p className="font-semibold">Recursos que podem ser afetados</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>{preview.resources.dnsRecords.length} registro(s) DNS</li>
                      <li>{preview.resources.applications.length} aplicação(ões) MiniHost</li>
                      <li>
                        {preview.resources.applications.filter((app) => app.hasCoolify).length} aplicação(ões) Coolify
                      </li>
                      <li>
                        {coolifyProjects.length > 0
                          ? `${coolifyProjects.length} projeto(s) Coolify: ${coolifyProjectNames}`
                          : "Nenhum projeto Coolify"}
                      </li>
                      <li>{preview.resources.databases.length} banco(s) PostgreSQL</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-zinc-200 p-4">
                <p className="text-sm font-semibold text-zinc-950">Opções de execução</p>
                <label className="flex items-start gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={options.archiveProject}
                    onChange={(event) => setOptions((current) => ({ ...current, archiveProject: event.target.checked }))}
                    className="mt-1"
                  />
                  <span>Arquivar projeto no MiniHost</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={options.deleteDnsRecords}
                    onChange={(event) => setOptions((current) => ({ ...current, deleteDnsRecords: event.target.checked }))}
                    className="mt-1"
                  />
                  <span>Excluir DNS Cloudflare vinculados</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={options.deleteCoolifyApplications}
                    onChange={(event) =>
                      setOptions((current) => ({ ...current, deleteCoolifyApplications: event.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>Excluir aplicações no Coolify</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={options.deleteCoolifyProject}
                    disabled={coolifyProjects.length === 0}
                    onChange={(event) =>
                      setOptions((current) => ({ ...current, deleteCoolifyProject: event.target.checked }))
                    }
                    className="mt-1 disabled:opacity-60"
                  />
                  <span>
                    Excluir projeto Coolify
                    {coolifyProjects.length > 0 ? ` (${coolifyProjectNames})` : ""}
                    {coolifyProjects.some((item) => item.createdByMiniHost) ? " — criado pelo MiniHost" : ""}
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={options.destroyDatabases}
                    onChange={(event) => setOptions((current) => ({ ...current, destroyDatabases: event.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    Desprovisionar bancos PostgreSQL vinculados
                    <span className="mt-1 block text-xs text-amber-800">
                      Banco PostgreSQL é destrutivo. Use o fluxo próprio de desprovisionamento de banco ou marque
                      explicitamente.
                    </span>
                  </span>
                </label>
                {externalCoolifyProjects.length > 0 && options.deleteCoolifyProject ? (
                  <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <input
                      type="checkbox"
                      checked={options.confirmExternalCoolifyRemoval}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          confirmExternalCoolifyRemoval: event.target.checked
                        }))
                      }
                      className="mt-1"
                    />
                    <span>
                      Confirmo remoção de projeto(s) Coolify externo(s):{" "}
                      {externalCoolifyProjects.map((item) => item.name).join(", ")} (não criado(s) pelo MiniHost).
                    </span>
                  </label>
                ) : null}
              </div>

              <label className="flex items-start gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={understandRisk}
                  onChange={(event) => setUnderstandRisk(event.target.checked)}
                  className="mt-1"
                />
                <span>Eu entendo que esta ação pode remover DNS e aplicações reais.</span>
              </label>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">
                  Digite <span className="font-mono text-rose-700">{expectedConfirmation}</span> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={expectedConfirmation}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2.5 font-mono text-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />
              </div>
            </>
          ) : null}
        </div>
      ) : result ? (
        <div className="space-y-4">
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              result.partial
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {result.message}
          </div>
          <TerminationChecklist steps={result.steps} />
          {result.pending.length > 0 ? (
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-sm font-semibold text-zinc-950">Pendências</p>
              <ul className="mt-3 space-y-2">
                {result.pending.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    <span className="font-medium">{item.label ?? item.id}</span>
                    <span className="block text-rose-700">{item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
