"use client";

import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getApplicationTypeLabel } from "@/components/projects/applications/ApplicationBadges";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import {
  buildApplicationProvisionConfirmationText,
  canCreateInCoolify,
  maskEnvValueForPreview,
  normalizeCoolifyDomain
} from "@/lib/coolify-provision";
import type {
  CoolifyProjectCache,
  CoolifyServerCache,
  Project,
  ProjectApplication,
  ProjectApplicationEnvVar
} from "@/lib/types";

interface CreateCoolifyApplicationModalProps {
  application?: ProjectApplication;
  project?: Project;
  servers: CoolifyServerCache[];
  projects: CoolifyProjectCache[];
  hasCoolifyCredential: boolean;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (input: {
    coolifyServerId: string;
    coolifyProjectId: string;
    confirmationText: string;
    applyEnvsAfterCreate: boolean;
    deployAfterCreate: boolean;
  }) => void;
}

function isSensitiveEnvKey(key: string) {
  const upper = key.toUpperCase();
  return ["DATABASE_URL", "POSTGRES_PASSWORD", "API_KEY", "SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY"].some(
    (part) => upper === part || upper.includes(part)
  );
}

export function CreateCoolifyApplicationModal({
  application,
  project,
  servers,
  projects,
  hasCoolifyCredential,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm
}: CreateCoolifyApplicationModalProps) {
  const [coolifyServerId, setCoolifyServerId] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [applyEnvsAfterCreate, setApplyEnvsAfterCreate] = useState(false);
  const [deployAfterCreate, setDeployAfterCreate] = useState(false);
  const [wasCopied, setWasCopied] = useState(false);

  const linkedCoolifyProject = project?.coolifyLink?.coolifyProject;

  useEffect(() => {
    if (isOpen && application) {
      setCoolifyServerId(application.coolifyServer?.id ?? servers[0]?.id ?? "");
      setConfirmationText("");
      setApplyEnvsAfterCreate(false);
      setDeployAfterCreate(false);
      setWasCopied(false);
    }
  }, [isOpen, application?.id, application?.coolifyServer?.id, servers]);

  const selectedServer = servers.find((server) => server.id === coolifyServerId);
  const coolifyProjectId = linkedCoolifyProject?.id ?? "";
  const selectedProject = linkedCoolifyProject;
  const expectedText = application ? buildApplicationProvisionConfirmationText(application.slug) : "";
  const isValidConfirmation = confirmationText === expectedText;

  const eligibility = useMemo(() => {
    if (!application) {
      return { allowed: false, reasons: ["Aplicação não selecionada."] };
    }

    return canCreateInCoolify({
      status: application.status,
      type: application.type,
      gitRepository: application.gitRepository,
      gitBranch: application.gitBranch,
      coolifyApplicationId: application.coolifyApplication?.id,
      coolifyServerId,
      coolifyProjectId,
      hasCoolifyCredential,
      hasActiveServer: selectedServer?.status === "ACTIVE",
      hasActiveProject: selectedProject?.status === "ACTIVE",
      hasProjectCoolifyLink: Boolean(linkedCoolifyProject)
    });
  }, [application, coolifyServerId, coolifyProjectId, hasCoolifyCredential, selectedProject, selectedServer, linkedCoolifyProject]);

  async function copyConfirmationText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setWasCopied(true);
      window.setTimeout(() => setWasCopied(false), 2000);
    } catch {
      setWasCopied(false);
    }
  }

  if (!application) {
    return null;
  }

  const environmentVariables: ProjectApplicationEnvVar[] = application.environmentVariables ?? [];

  return (
    <Modal isOpen={isOpen} title="Criar no Coolify" size="lg" onClose={onClose}>
      <div className="space-y-5">
        <Notice
          type="info"
          message="Será criada uma aplicação real no Coolify a partir de um repositório público. O projeto Coolify é herdado do projeto MiniHost. Criar a aplicação não inicia deploy automaticamente — aplique variáveis e execute deploy em etapas separadas, se desejar."
        />

        {!linkedCoolifyProject ? (
          <Notice
            type="error"
            message="Crie ou vincule um projeto Coolify na seção do projeto antes de provisionar aplicações."
          />
        ) : null}

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-zinc-950">Destino Coolify</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Servidor</span>
              <select
                value={coolifyServerId}
                disabled={isSubmitting}
                onChange={(event) => setCoolifyServerId(event.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="">Selecione</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Projeto Coolify (herdado)</span>
              <p className="rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
                {linkedCoolifyProject?.name ?? "Nenhum projeto Coolify vinculado ao projeto MiniHost"}
              </p>
            </label>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-zinc-500">Ambiente</p>
              <p className="mt-1 text-sm text-zinc-700">production (padrão do Coolify)</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-950">Configuração da aplicação</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PreviewItem label="Repositório Git" value={application.gitRepository} />
            <PreviewItem label="Branch" value={application.gitBranch} />
            <PreviewItem label="Domínio / FQDN" value={normalizeCoolifyDomain(application.domain)} />
            <PreviewItem label="Porta" value={application.port ? String(application.port) : undefined} />
            <PreviewItem label="Build command" value={application.buildCommand} />
            <PreviewItem label="Start command" value={application.startCommand} />
            <PreviewItem label="Install command" value={application.installCommand} />
            <PreviewItem label="Root directory" value={application.rootDirectory} />
          </div>
        </div>

        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm font-semibold text-violet-950">Preview — será criada uma aplicação real no Coolify com estes dados:</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PreviewItem label="Nome" value={application.name} />
            <PreviewItem label="Projeto MiniHost" value={project?.name} />
            <PreviewItem label="Projeto Coolify" value={selectedProject?.name} />
            <PreviewItem label="Servidor Coolify" value={selectedServer?.name} />
            <PreviewItem label="Repositório" value={application.gitRepository} />
            <PreviewItem label="Branch" value={application.gitBranch} />
            <PreviewItem label="Domínio / FQDN" value={normalizeCoolifyDomain(application.domain)} />
            <PreviewItem label="Porta" value={application.port ? String(application.port) : undefined} />
            <PreviewItem label="Tipo" value={getApplicationTypeLabel(application.type)} />
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase text-violet-700">Variáveis de ambiente configuradas</p>
            {environmentVariables.length === 0 ? (
              <p className="mt-2 text-sm text-violet-900">Nenhuma variável configurada.</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-sm text-violet-950">
                {environmentVariables.map((variable) => (
                  <li key={variable.key}>
                    {variable.key} = {maskEnvValueForPreview(variable.key, variable.value, isSensitiveEnvKey)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {!eligibility.allowed ? (
          <Notice type="error" message={eligibility.reasons.join(" ")} />
        ) : null}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Pós-criação opcional</p>
          <p className="mt-1 text-sm text-amber-900">
            Por padrão, apenas a aplicação é criada no Coolify com status LINKED. Marque as opções abaixo apenas se quiser executar o fluxo completo automaticamente.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={applyEnvsAfterCreate}
              disabled={isSubmitting || environmentVariables.length === 0}
              onChange={(event) => setApplyEnvsAfterCreate(event.target.checked)}
              className="mt-1"
            />
            <span>
              Aplicar envs após criar
              {environmentVariables.length === 0 ? " (nenhuma variável planejada)" : ""}
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={deployAfterCreate}
              disabled={isSubmitting}
              onChange={(event) => setDeployAfterCreate(event.target.checked)}
              className="mt-1"
            />
            <span>Iniciar deploy após criar</span>
          </label>
        </div>

        <div>
          <label htmlFor="coolify-app-confirmation" className="block text-sm font-medium text-zinc-700">
            Confirmação forte
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Digite exatamente:{" "}
            <span className="inline-flex max-w-full items-center gap-1 align-middle">
              <code className="truncate rounded bg-zinc-100 px-1 py-0.5 font-mono">{expectedText}</code>
              <button
                type="button"
                onClick={() => void copyConfirmationText(expectedText)}
                aria-label="Copiar texto de confirmação"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-violet-600 transition hover:bg-violet-50 hover:text-violet-700"
              >
                {wasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </span>
          </p>
          <input
            id="coolify-app-confirmation"
            value={confirmationText}
            disabled={isSubmitting}
            onChange={(event) => setConfirmationText(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            placeholder={expectedText}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                coolifyServerId,
                coolifyProjectId,
                confirmationText,
                applyEnvsAfterCreate,
                deployAfterCreate
              })
            }
            disabled={isSubmitting || !eligibility.allowed || !isValidConfirmation || !coolifyServerId || !coolifyProjectId}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando no Coolify...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Criar no Coolify
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm text-zinc-800">{value?.trim() || "-"}</p>
    </div>
  );
}
