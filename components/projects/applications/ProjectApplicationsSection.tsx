"use client";

import { Archive, CheckCircle2, Code2, ExternalLink, Eye, Link2, Plus, RefreshCw, Rocket, Save, Settings2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApplicationStatusBadge, ApplicationTypeBadge, getApplicationTypeLabel } from "@/components/projects/applications/ApplicationBadges";
import { ApplyEnvsCoolifyModal } from "@/components/projects/applications/ApplyEnvsCoolifyModal";
import { CoolifyProvisionChecklist } from "@/components/projects/applications/CoolifyProvisionChecklist";
import { CreateCoolifyApplicationModal } from "@/components/projects/applications/CreateCoolifyApplicationModal";
import { DeployCoolifyModal } from "@/components/projects/applications/DeployCoolifyModal";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import { canShowApplyEnvsButton, canShowCreateInCoolifyButton, canShowDeployButton, buildCoolifyApplicationUrl } from "@/lib/coolify-provision";
import { formatDateTime, formatRecordValue } from "@/lib/format";
import type {
  CoolifyApplicationCache,
  CoolifyProjectCache,
  CoolifyServerCache,
  DnsRecord,
  Domain,
  Project,
  ProjectApplication,
  ProjectApplicationEnvVar,
  ProjectApplicationFormInput,
  ProjectApplicationType,
  ProjectDatabase
} from "@/lib/types";

interface ProjectApplicationsSectionProps {
  project: Project;
  linkedRecords: DnsRecord[];
  domains: Domain[];
  onChanged?: () => void;
}

type ApplicationsResponse = { applications: ProjectApplication[] };
type ApplicationResponse = {
  application: ProjectApplication;
  message?: string;
  warning?: string;
  readiness?: ProjectApplication["readiness"];
};
type DatabasesResponse = { databases: ProjectDatabase[] };
type CoolifyResponse = {
  coolify?: {
    hasCredential: boolean;
    baseUrl?: string;
  };
  servers: CoolifyServerCache[];
  projects: CoolifyProjectCache[];
  applications: CoolifyApplicationCache[];
};
type EnvResponse = { envContent: string; warning: string };

type ToastState = { type: "success" | "error" | "info"; message: string } | null;

const applicationTypes: ProjectApplicationType[] = [
  "FRONTEND",
  "BACKEND",
  "FULLSTACK",
  "STATIC",
  "DOCKERFILE",
  "DOCKER_COMPOSE",
  "OTHER"
];

const fieldClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultPort(type: ProjectApplicationType) {
  if (type === "BACKEND" || type === "FULLSTACK" || type === "FRONTEND") {
    return "3000";
  }

  return "";
}

function applyTypeDefaults(
  current: ProjectApplicationFormInput,
  type: ProjectApplicationType
): ProjectApplicationFormInput {
  if (type === "STATIC") {
    return {
      ...current,
      type,
      port: "",
      startCommand: "",
      outputDirectory: current.outputDirectory?.trim() ? current.outputDirectory : "/dist",
      projectDatabaseId: null,
      buildCommand: current.buildCommand?.trim() ? current.buildCommand : "npm run build"
    };
  }

  if (type === "FRONTEND") {
    return {
      ...current,
      type,
      port: current.port || defaultPort(type),
      startCommand: "",
      projectDatabaseId: current.projectDatabaseId || null
    };
  }

  return {
    ...current,
    type,
    port: current.port || defaultPort(type)
  };
}

function serializeApplicationForm(form: ProjectApplicationFormInput): ProjectApplicationFormInput {
  return {
    ...form,
    projectDatabaseId: form.projectDatabaseId?.trim() ? form.projectDatabaseId.trim() : null,
    dnsRecordId: form.dnsRecordId?.trim() ? form.dnsRecordId.trim() : null,
    port: form.port === "" || form.port === null || form.port === undefined ? null : form.port
  };
}

function getDomainName(domains: Domain[], domainId: string) {
  return domains.find((domain) => domain.id === domainId)?.name ?? "";
}

function fullRecordName(record: DnsRecord, domains: Domain[]) {
  const domainName = getDomainName(domains, record.domainId);

  if (!domainName) {
    return record.name;
  }

  if (!record.name || record.name === "@") {
    return domainName;
  }

  return record.name.endsWith(`.${domainName}`) ? record.name : `${record.name}.${domainName}`;
}

function createDefaultForm(project: Project, domain = ""): ProjectApplicationFormInput {
  const name = `${project.name} App`;

  return {
    name,
    slug: slugify(name),
    type: "FULLSTACK",
    gitRepository: "",
    gitBranch: "main",
    rootDirectory: "",
    installCommand: "npm install",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    outputDirectory: "",
    port: "3000",
    domain,
    notes: "",
    projectDatabaseId: null,
    dnsRecordId: null,
    environmentVariables: []
  };
}

function toForm(application: ProjectApplication): ProjectApplicationFormInput {
  return {
    name: application.name,
    slug: application.slug,
    type: application.type,
    gitRepository: application.gitRepository ?? "",
    gitBranch: application.gitBranch ?? "main",
    rootDirectory: application.rootDirectory ?? "",
    installCommand: application.installCommand ?? "",
    buildCommand: application.buildCommand ?? "",
    startCommand: application.startCommand ?? "",
    outputDirectory: application.outputDirectory ?? "",
    port: application.port ? String(application.port) : "",
    domain: application.domain ?? "",
    notes: application.notes ?? "",
    projectDatabaseId: application.projectDatabaseId ?? null,
    dnsRecordId: application.dnsRecordId ?? null,
    environmentVariables: application.environmentVariables ?? []
  };
}

function isSensitiveEnvKey(key: string) {
  const upper = key.toUpperCase();
  return ["DATABASE_URL", "POSTGRES_PASSWORD", "API_KEY", "SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY"].some(
    (part) => upper === part || upper.includes(part)
  );
}

export function ProjectApplicationsSection({ project, linkedRecords, domains, onChanged }: ProjectApplicationsSectionProps) {
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [databases, setDatabases] = useState<ProjectDatabase[]>([]);
  const [coolifyServers, setCoolifyServers] = useState<CoolifyServerCache[]>([]);
  const [coolifyProjects, setCoolifyProjects] = useState<CoolifyProjectCache[]>([]);
  const [coolifyApplications, setCoolifyApplications] = useState<CoolifyApplicationCache[]>([]);
  const [form, setForm] = useState<ProjectApplicationFormInput>(() => createDefaultForm(project));
  const [editingApplication, setEditingApplication] = useState<ProjectApplication | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ProjectApplication | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjectApplication | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isCreateCoolifyOpen, setIsCreateCoolifyOpen] = useState(false);
  const [isApplyEnvsOpen, setIsApplyEnvsOpen] = useState(false);
  const [isDeployCoolifyOpen, setIsDeployCoolifyOpen] = useState(false);
  const [hasCoolifyCredential, setHasCoolifyCredential] = useState(false);
  const [coolifyBaseUrl, setCoolifyBaseUrl] = useState<string | undefined>(undefined);
  const [generatedEnv, setGeneratedEnv] = useState<string | null>(null);
  const [generatedWarning, setGeneratedWarning] = useState<string | null>(null);
  const [coolifySelection, setCoolifySelection] = useState({
    serverId: "",
    applicationId: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const isArchivedProject =
    project.status === "ARCHIVED" ||
    project.status === "TERMINATED" ||
    project.status === "TERMINATED_WITH_ERRORS" ||
    project.status === "TERMINATING";

  const domainOptions = useMemo(
    () => linkedRecords.filter((record) => record.status !== "DELETED").map((record) => ({
      id: record.id,
      label: `${fullRecordName(record, domains)} (${record.type})`,
      domain: fullRecordName(record, domains)
    })),
    [linkedRecords, domains]
  );
  const activeCoolifyServers = useMemo(
    () => coolifyServers.filter((server) => server.status === "ACTIVE"),
    [coolifyServers]
  );
  const activeCoolifyProjects = useMemo(
    () => coolifyProjects.filter((coolifyProject) => coolifyProject.status === "ACTIVE"),
    [coolifyProjects]
  );
  const activeCoolifyApplications = useMemo(
    () => coolifyApplications.filter((application) => application.status === "ACTIVE"),
    [coolifyApplications]
  );
  const linkedCoolifyProject = project.coolifyLink?.coolifyProject;

  async function reload() {
    try {
      setIsLoading(true);
      const [applicationData, databaseData, coolifyData] = await Promise.all([
        apiRequest<ApplicationsResponse>(`/api/projects/${project.id}/applications`),
        apiRequest<DatabasesResponse>(`/api/projects/${project.id}/databases`),
        apiRequest<CoolifyResponse>("/api/coolify")
      ]);

      setApplications(applicationData.applications);
      setDatabases(databaseData.databases.filter((database) => !["ARCHIVED", "DESTROYED", "PARTIALLY_DESTROYED"].includes(database.status)));
      setCoolifyServers(coolifyData.servers);
      setCoolifyProjects(coolifyData.projects);
      setCoolifyApplications(coolifyData.applications);
      setHasCoolifyCredential(Boolean(coolifyData.coolify?.hasCredential));
      setCoolifyBaseUrl(coolifyData.coolify?.baseUrl);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [project.id]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), toast.type === "error" ? 6500 : 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function updateForm<Key extends keyof ProjectApplicationFormInput>(key: Key, value: ProjectApplicationFormInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateForm() {
    const suggestedDomain = domainOptions[0]?.domain ?? project.mainDomain ?? "";
    setEditingApplication(null);
    setForm(createDefaultForm(project, suggestedDomain));
    setIsFormOpen(true);
  }

  async function openEditForm(application: ProjectApplication) {
    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse>(`/api/projects/${project.id}/applications/${application.id}`);
      setEditingApplication(data.application);
      setForm(toForm(data.application));
      setIsFormOpen(true);
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível abrir a aplicação."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openDetails(application: ProjectApplication) {
    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse>(`/api/projects/${project.id}/applications/${application.id}`);
      setSelectedApplication(data.application);
      setCoolifySelection({
        serverId: data.application.coolifyServer?.id ?? "",
        applicationId: data.application.coolifyApplication?.id ?? ""
      });
      setGeneratedEnv(null);
      setGeneratedWarning(null);
      setIsDetailOpen(true);
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível abrir a aplicação."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setToast({ type: "error", message: "Informe o nome da aplicação." });
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = editingApplication
        ? `/api/projects/${project.id}/applications/${editingApplication.id}`
        : `/api/projects/${project.id}/applications`;
      const data = await apiRequest<ApplicationResponse>(endpoint, {
        method: editingApplication ? "PATCH" : "POST",
        body: JSON.stringify(serializeApplicationForm(form))
      });

      setIsFormOpen(false);
      setEditingApplication(null);
      setSelectedApplication(data.application);
      setToast({
        type: data.warning ? "info" : "success",
        message: data.warning
          ? `${editingApplication ? "Aplicação atualizada." : "Aplicação planejada criada."} ${data.warning}`
          : editingApplication
            ? "Aplicação atualizada."
            : "Aplicação planejada criada."
      });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar a aplicação."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiRequest(`/api/projects/${project.id}/applications/${archiveTarget.id}/archive`, { method: "POST" });
      setArchiveTarget(null);
      setToast({ type: "success", message: "Aplicação arquivada." });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível arquivar a aplicação."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshSelected(applicationId: string) {
    const data = await apiRequest<ApplicationResponse>(`/api/projects/${project.id}/applications/${applicationId}`);
    setSelectedApplication(data.application);
    return data.application;
  }

  async function handleImportDatabaseEnv() {
    if (!selectedApplication?.id) {
      return;
    }

    const databaseId = selectedApplication.projectDatabaseId;

    if (!databaseId) {
      setToast({ type: "error", message: "Vincule um banco PostgreSQL antes de importar variáveis." });
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse>(
        `/api/projects/${project.id}/applications/${selectedApplication.id}/import-database-env`,
        {
          method: "POST",
          body: JSON.stringify({ databaseId })
        }
      );
      setSelectedApplication(data.application);
      setToast({ type: "success", message: data.message ?? "Variáveis importadas." });
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível importar variáveis do banco."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateEnv() {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<EnvResponse>(
        `/api/projects/${project.id}/applications/${selectedApplication.id}/generate-env`,
        {
          method: "POST",
          body: JSON.stringify({ confirmSensitive: true })
        }
      );
      setGeneratedEnv(data.envContent);
      setGeneratedWarning(data.warning);
      setIsGenerateDialogOpen(false);
      setToast({ type: "success", message: ".env gerado para a aplicação." });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível gerar o .env."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkCoolify() {
    if (!selectedApplication) {
      return;
    }

    if (!coolifySelection.applicationId) {
      setToast({ type: "error", message: "Selecione uma aplicação Coolify sincronizada." });
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse>(
        `/api/projects/${project.id}/applications/${selectedApplication.id}/link-coolify`,
        {
          method: "POST",
          body: JSON.stringify({
            coolifyServerId: coolifySelection.serverId || null,
            coolifyApplicationId: coolifySelection.applicationId
          })
        }
      );
      setSelectedApplication(data.application);
      setToast({ type: "success", message: data.message ?? "Aplicação vinculada ao Coolify." });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível vincular ao Coolify."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReadyCheck() {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse>(
        `/api/projects/${project.id}/applications/${selectedApplication.id}/ready-check`,
        { method: "POST" }
      );
      setSelectedApplication(data.application);
      setToast({ type: data.readiness?.ready ? "success" : "info", message: data.message ?? "Validação concluída." });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível validar a aplicação."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateInCoolify(input: {
    coolifyServerId: string;
    coolifyProjectId: string;
    confirmationText: string;
    applyEnvsAfterCreate: boolean;
    deployAfterCreate: boolean;
  }) {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse & { envWarning?: string }>(
        "/api/coolify/applications/create-public",
        {
          method: "POST",
          body: JSON.stringify({
            projectApplicationId: selectedApplication.id,
            coolifyServerId: input.coolifyServerId,
            coolifyProjectId: input.coolifyProjectId,
            confirmationText: input.confirmationText,
            applyEnvsAfterCreate: input.applyEnvsAfterCreate,
            deployAfterCreate: input.deployAfterCreate
          })
        }
      );

      setSelectedApplication(data.application);
      setIsCreateCoolifyOpen(false);
      setToast({
        type: data.envWarning ? "info" : "success",
        message: data.envWarning ? `${data.message ?? "Aplicação criada."} ${data.envWarning}` : data.message ?? "Aplicação criada no Coolify com sucesso."
      });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível criar a aplicação no Coolify."
      });
      if (selectedApplication) {
        await refreshSelected(selectedApplication.id).catch(() => undefined);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApplyEnvs(input: { confirmationText: string }) {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse & { skipped?: boolean }>(
        "/api/coolify/applications/apply-envs",
        {
          method: "POST",
          body: JSON.stringify({
            projectApplicationId: selectedApplication.id,
            confirmationText: input.confirmationText
          })
        }
      );

      setSelectedApplication(data.application);
      setIsApplyEnvsOpen(false);
      setToast({
        type: "success",
        message: data.message ?? "Variáveis aplicadas no Coolify com sucesso."
      });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível aplicar variáveis no Coolify."
      });
      if (selectedApplication) {
        await refreshSelected(selectedApplication.id).catch(() => undefined);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeployCoolify(input: { confirmationText: string }) {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ApplicationResponse>("/api/coolify/applications/deploy", {
        method: "POST",
        body: JSON.stringify({
          projectApplicationId: selectedApplication.id,
          confirmationText: input.confirmationText
        })
      });

      setSelectedApplication(data.application);
      setIsDeployCoolifyOpen(false);
      setToast({
        type: "success",
        message: data.message ?? "Deploy iniciado com sucesso."
      });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível iniciar deploy no Coolify."
      });
      if (selectedApplication) {
        await refreshSelected(selectedApplication.id).catch(() => undefined);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSyncCoolifyStatus() {
    try {
      setIsSubmitting(true);
      const data = await apiRequest<{ message?: string }>("/api/coolify/sync", { method: "POST" });
      await reload();
      if (selectedApplication) {
        await refreshSelected(selectedApplication.id);
      }
      setToast({ type: "success", message: data.message ?? "Coolify sincronizado." });
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível sincronizar o Coolify."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateEnv(index: number, key: keyof ProjectApplicationEnvVar, value: string) {
    const variables = [...(form.environmentVariables ?? [])];
    variables[index] = { ...variables[index], [key]: value };
    updateForm("environmentVariables", variables);
  }

  function removeEnv(index: number) {
    updateForm("environmentVariables", (form.environmentVariables ?? []).filter((_, itemIndex) => itemIndex !== index));
  }

  const selectedCoolifyResources = selectedApplication
    ? [selectedApplication.coolifyServer, selectedApplication.coolifyProject, selectedApplication.coolifyApplication].filter(Boolean)
    : [];
  const hasRemovedCoolifyResource = selectedCoolifyResources.some((resource) => resource?.status === "REMOVED");
  const hasMissingCoolifyResource = selectedCoolifyResources.some((resource) => resource?.status === "MISSING");
  const createCoolifyEligibility = selectedApplication
    ? canShowCreateInCoolifyButton({
        status: selectedApplication.status,
        type: selectedApplication.type,
        gitRepository: selectedApplication.gitRepository,
        gitBranch: selectedApplication.gitBranch,
        coolifyApplicationId: selectedApplication.coolifyApplication?.id,
        coolifyServerId: selectedApplication.coolifyServer?.id ?? coolifySelection.serverId,
        coolifyProjectId: linkedCoolifyProject?.id,
        hasCoolifyCredential,
        hasActiveServer: activeCoolifyServers.length > 0,
        hasActiveProject: linkedCoolifyProject?.status === "ACTIVE",
        hasProjectCoolifyLink: Boolean(linkedCoolifyProject)
      })
    : { allowed: false, reasons: [] };
  const applyEnvsEligibility = selectedApplication
    ? canShowApplyEnvsButton({
        coolifyApplicationId: selectedApplication.coolifyApplication?.id,
        coolifyApplicationStatus: selectedApplication.coolifyApplication?.status,
        coolifyServerStatus: selectedApplication.coolifyServer?.status,
        coolifyProjectStatus: selectedApplication.coolifyProject?.status,
        environmentVariableCount:
          selectedApplication.environmentVariables?.length ??
          selectedApplication.environmentVariableKeys?.length ??
          0,
        applicationStatus: selectedApplication.status
      })
    : { allowed: false, reasons: [] };
  const deployEligibility = selectedApplication
    ? canShowDeployButton({
        coolifyApplicationId: selectedApplication.coolifyApplication?.id,
        coolifyApplicationStatus: selectedApplication.coolifyApplication?.status,
        coolifyServerStatus: selectedApplication.coolifyServer?.status,
        coolifyProjectStatus: selectedApplication.coolifyProject?.status,
        environmentVariableCount:
          selectedApplication.environmentVariables?.length ??
          selectedApplication.environmentVariableKeys?.length ??
          0,
        applicationStatus: selectedApplication.status
      })
    : { allowed: false, reasons: [] };
  const coolifyOpenUrl =
    selectedApplication?.coolifyApplication?.coolifyId &&
    selectedApplication.coolifyProject?.coolifyId &&
    coolifyBaseUrl
      ? buildCoolifyApplicationUrl(
          coolifyBaseUrl,
          selectedApplication.coolifyProject.coolifyId,
          selectedApplication.coolifyApplication.coolifyId
        )
      : null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-soft">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">Aplicações</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Planeje apps e crie aplicações reais no Coolify a partir de repositórios públicos.
          </p>
        </div>
        {!isArchivedProject ? (
          <button
            type="button"
            onClick={openCreateForm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            Nova aplicação
          </button>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <Notice type="info" message="Nesta etapa é possível criar aplicações reais no Coolify apenas com repositório público via HTTPS. Repositórios privados, GitHub App e Deploy Key ficam para etapas futuras." />
      </div>

      {isLoading ? (
        <div className="px-6 py-10 text-center text-sm text-zinc-500">Carregando aplicações...</div>
      ) : applications.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">Nenhuma aplicação planejada neste projeto.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-normal text-zinc-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Repositório</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Domínio</th>
                <th className="px-4 py-3">Porta</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Coolify</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {applications.map((application) => (
                <tr key={application.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                  <td className="px-4 py-4">
                    <span className="block font-semibold text-zinc-950">{application.name}</span>
                    <span className="mt-1 block font-mono text-xs text-zinc-500">{application.slug}</span>
                  </td>
                  <td className="px-4 py-4"><ApplicationTypeBadge type={application.type} /></td>
                  <td className="px-4 py-4">
                    <span className="block max-w-[220px] truncate" title={application.gitRepository ?? ""}>
                      {application.gitRepository || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-4">{application.gitBranch || "-"}</td>
                  <td className="px-4 py-4">{application.domain || "-"}</td>
                  <td className="px-4 py-4">{application.port ?? "-"}</td>
                  <td className="px-4 py-4"><ApplicationStatusBadge status={application.status} /></td>
                  <td className="px-4 py-4">
                    {application.coolifyApplication ? <Badge variant="success">{application.coolifyApplication.name}</Badge> : <Badge>Sem vínculo</Badge>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void openDetails(application)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalhes
                      </button>
                      {!isArchivedProject && application.status !== "ARCHIVED" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void openEditForm(application)}
                            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(application)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Arquivar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        title={editingApplication ? "Editar aplicação" : "Nova aplicação"}
        size="lg"
        onClose={() => (isSubmitting ? undefined : setIsFormOpen(false))}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSubmitting} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
              Cancelar
            </button>
            <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
              <Save className="h-4 w-4" />
              {isSubmitting ? "Salvando..." : "Salvar aplicação"}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Nome</span>
              <input
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((current) => ({ ...current, name, slug: current.slug ? current.slug : slugify(name) }));
                }}
                className={fieldClass}
                placeholder="API Systagio"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Slug</span>
              <input value={form.slug ?? ""} onChange={(event) => updateForm("slug", event.target.value)} className={fieldClass} placeholder="api-systagio" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Tipo</span>
              <select
                value={form.type}
                onChange={(event) => {
                  const type = event.target.value as ProjectApplicationType;
                  setForm((current) => applyTypeDefaults(current, type));
                }}
                className={fieldClass}
              >
                {applicationTypes.map((type) => (
                  <option key={type} value={type}>{getApplicationTypeLabel(type)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Repositório Git</span>
              <input value={form.gitRepository ?? ""} onChange={(event) => updateForm("gitRepository", event.target.value)} className={fieldClass} placeholder="https://github.com/user/app" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Branch</span>
              <input value={form.gitBranch ?? ""} onChange={(event) => updateForm("gitBranch", event.target.value)} className={fieldClass} placeholder="main" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Diretório raiz</span>
              <input value={form.rootDirectory ?? ""} onChange={(event) => updateForm("rootDirectory", event.target.value)} className={fieldClass} placeholder="/" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Install command</span>
              <input value={form.installCommand ?? ""} onChange={(event) => updateForm("installCommand", event.target.value)} className={fieldClass} placeholder="npm install" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Build command</span>
              <input value={form.buildCommand ?? ""} onChange={(event) => updateForm("buildCommand", event.target.value)} className={fieldClass} placeholder="npm run build" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Start command</span>
              <input value={form.startCommand ?? ""} onChange={(event) => updateForm("startCommand", event.target.value)} className={fieldClass} placeholder="npm run start" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Output directory</span>
              <input value={form.outputDirectory ?? ""} onChange={(event) => updateForm("outputDirectory", event.target.value)} className={fieldClass} placeholder={form.type === "STATIC" ? "/dist" : "/dist ou /.next"} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Porta</span>
              <input value={String(form.port ?? "")} onChange={(event) => updateForm("port", event.target.value)} className={fieldClass} placeholder="3000" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">DNS vinculado</span>
              <select
                value={form.dnsRecordId ?? ""}
                onChange={(event) => {
                  const selected = domainOptions.find((option) => option.id === event.target.value);
                  setForm((current) => ({ ...current, dnsRecordId: event.target.value, domain: selected?.domain ?? current.domain }));
                }}
                className={fieldClass}
              >
                <option value="">Sem DNS vinculado</option>
                {domainOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Domínio</span>
              <input value={form.domain ?? ""} onChange={(event) => updateForm("domain", event.target.value)} className={fieldClass} placeholder="app.exemplo.com" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Banco PostgreSQL</span>
              <select value={form.projectDatabaseId ?? ""} onChange={(event) => updateForm("projectDatabaseId", event.target.value)} className={fieldClass}>
                <option value="">Sem banco vinculado</option>
                {databases.map((database) => (
                  <option key={database.id} value={database.id}>{database.name} ({database.databaseName})</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Observações</span>
            <textarea value={form.notes ?? ""} onChange={(event) => updateForm("notes", event.target.value)} className={`${fieldClass} min-h-24`} placeholder="Notas internas sobre build, runtime ou deploy futuro." />
          </label>

          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">Variáveis de ambiente</h4>
                <p className="mt-1 text-sm text-zinc-500">Valores são salvos criptografados no banco.</p>
              </div>
              <button type="button" onClick={() => updateForm("environmentVariables", [...(form.environmentVariables ?? []), { key: "", value: "" }])} className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                <Plus className="h-4 w-4" />
                Variável
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {(form.environmentVariables ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma variável manual adicionada.</p>
              ) : (
                (form.environmentVariables ?? []).map((variable, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                    <input value={variable.key} onChange={(event) => updateEnv(index, "key", event.target.value)} className={fieldClass} placeholder="NOME_VARIAVEL" />
                    <input value={variable.value} onChange={(event) => updateEnv(index, "value", event.target.value)} className={fieldClass} placeholder="valor" type={isSensitiveEnvKey(variable.key) ? "password" : "text"} />
                    <button type="button" onClick={() => removeEnv(index)} className="inline-flex h-10 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-rose-700 transition hover:bg-rose-100" aria-label="Remover variável">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDetailOpen && Boolean(selectedApplication)} title="Detalhes da aplicação" size="lg" onClose={() => setIsDetailOpen(false)}>
        {selectedApplication ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Aplicação</p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">{selectedApplication.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ApplicationTypeBadge type={selectedApplication.type} />
                  <ApplicationStatusBadge status={selectedApplication.status} />
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Deploy</p>
                <p className="mt-2 text-sm text-zinc-600">Repo: {selectedApplication.gitRepository || "-"}</p>
                <p className="mt-1 text-sm text-zinc-600">Branch: {selectedApplication.gitBranch || "-"}</p>
                <p className="mt-1 text-sm text-zinc-600">Domínio: {selectedApplication.domain || "-"}</p>
                <p className="mt-1 text-sm text-zinc-600">Porta: {selectedApplication.port ?? "-"}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Provisionamento: {selectedApplication.provisionedAt ? formatDateTime(selectedApplication.provisionedAt) : "-"}
                </p>
                {selectedApplication.lastProvisionMessage ? (
                  <p className="mt-2 text-sm text-zinc-600">{selectedApplication.lastProvisionMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-4">
              <h4 className="font-semibold text-zinc-950">Preview de deploy</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <p className="text-sm text-zinc-600">Build: {selectedApplication.buildCommand || "-"}</p>
                <p className="text-sm text-zinc-600">Start: {selectedApplication.startCommand || "-"}</p>
                <p className="text-sm text-zinc-600">DNS vinculado: {selectedApplication.dnsRecordId ? "sim" : "não"}</p>
                <p className="text-sm text-zinc-600">Banco vinculado: {selectedApplication.projectDatabaseId ? "sim" : "não"}</p>
                <p className="text-sm text-zinc-600">Coolify vinculado: {selectedApplication.coolifyApplication ? "sim" : "não"}</p>
                <p className="text-sm text-zinc-600">Pronto para provisionar: {selectedApplication.readiness?.ready ? "sim" : "não"}</p>
              </div>
              {selectedApplication.readiness?.issues.length ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {selectedApplication.readiness.issues.join(" ")}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-950">Variáveis de ambiente</h4>
                  <p className="mt-1 text-sm text-zinc-500">{selectedApplication.environmentVariables?.length ?? 0} variável(is) configurada(s).</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void handleImportDatabaseEnv()} disabled={isSubmitting || !selectedApplication.projectDatabaseId} className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60">
                    <Code2 className="h-4 w-4" />
                    Importar banco
                  </button>
                  <button type="button" onClick={() => setIsGenerateDialogOpen(true)} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60">
                    Gerar .env
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(selectedApplication.environmentVariables ?? []).map((variable) => (
                  <Badge key={variable.key} variant={isSensitiveEnvKey(variable.key) ? "warning" : "muted"}>
                    {variable.key}
                  </Badge>
                ))}
                {(selectedApplication.environmentVariables ?? []).length === 0 ? <span className="text-sm text-zinc-500">Nenhuma variável salva.</span> : null}
              </div>
              {generatedWarning ? <div className="mt-4"><Notice type="info" message={generatedWarning} /></div> : null}
              {generatedEnv ? <div className="mt-4"><CodeBlock label=".env da aplicação" content={generatedEnv} /></div> : null}
            </div>

            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-950">Coolify</h4>
                  <p className="mt-1 text-sm text-zinc-500">
                    Crie uma aplicação real no Coolify ou vincule com uma aplicação já sincronizada. O projeto Coolify é herdado do projeto MiniHost.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedApplication.coolifyApplication ? (
                    <Badge variant="success">{selectedApplication.coolifyApplication.name}</Badge>
                  ) : (
                    <Badge>Sem vínculo</Badge>
                  )}
                  {coolifyOpenUrl ? (
                    <a
                      href={coolifyOpenUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir no Coolify
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleSyncCoolifyStatus()}
                    disabled={isSubmitting || !hasCoolifyCredential}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sincronizar status
                  </button>
                </div>
              </div>
              {!linkedCoolifyProject ? (
                <div className="mt-4">
                  <Notice
                    type="info"
                    message="Crie ou vincule um projeto Coolify na seção do projeto antes de provisionar ou vincular aplicações."
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">
                  Projeto Coolify herdado: <span className="font-semibold text-zinc-900">{linkedCoolifyProject.name}</span>
                </p>
              )}
              {selectedApplication.coolifyApplication ? (
                <div className="mt-4 space-y-4">
                  <CoolifyProvisionChecklist application={selectedApplication} />
                  <div className="grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                    <p>Status MiniHost: {selectedApplication.status}</p>
                    <p>Status Coolify: {selectedApplication.coolifyApplication.remoteStatus || selectedApplication.coolifyApplication.status || "-"}</p>
                    <p>FQDN: {selectedApplication.coolifyApplication.fqdn || selectedApplication.domain || "-"}</p>
                    <p>Repositório: {selectedApplication.coolifyApplication.gitRepository || selectedApplication.gitRepository || "-"}</p>
                    <p>Branch: {selectedApplication.coolifyApplication.branch || selectedApplication.gitBranch || "-"}</p>
                    <p>Provisionado em: {selectedApplication.provisionedAt ? formatDateTime(selectedApplication.provisionedAt) : "-"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {applyEnvsEligibility.allowed ? (
                      <button
                        type="button"
                        onClick={() => setIsApplyEnvsOpen(true)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Settings2 className="h-4 w-4" />
                        Aplicar variáveis no Coolify
                      </button>
                    ) : null}
                    {deployEligibility.allowed ? (
                      <button
                        type="button"
                        onClick={() => setIsDeployCoolifyOpen(true)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Rocket className="h-4 w-4" />
                        Deploy no Coolify
                      </button>
                    ) : null}
                  </div>
                  {!applyEnvsEligibility.allowed && selectedApplication.coolifyApplication && (selectedApplication.environmentVariables?.length ?? 0) > 0 && selectedApplication.envsAppliedAt === undefined ? (
                    <Notice type="info" message="Aplicação criada, mas variáveis ainda não foram aplicadas." />
                  ) : null}
                  {!deployEligibility.allowed && selectedApplication.coolifyApplication && !selectedApplication.lastDeployStartedAt ? (
                    <Notice type="info" message="Aplicação criada, mas deploy ainda não foi iniciado." />
                  ) : null}
                </div>
              ) : null}
              {hasRemovedCoolifyResource ? (
                <div className="mt-4">
                  <Notice
                    type="error"
                    message="O recurso Coolify vinculado parece ter sido removido no Coolify. O vínculo local foi mantido para histórico."
                  />
                </div>
              ) : hasMissingCoolifyResource ? (
                <div className="mt-4">
                  <Notice
                    type="info"
                    message="O recurso Coolify vinculado não foi encontrado na última sincronização."
                  />
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <select value={coolifySelection.serverId} onChange={(event) => setCoolifySelection((current) => ({ ...current, serverId: event.target.value }))} className={fieldClass}>
                  <option value="">Servidor opcional</option>
                  {activeCoolifyServers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
                </select>
                <select value={coolifySelection.applicationId} onChange={(event) => setCoolifySelection((current) => ({ ...current, applicationId: event.target.value }))} className={fieldClass}>
                  <option value="">Aplicação Coolify</option>
                  {activeCoolifyApplications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
                </select>
                <button type="button" onClick={() => void handleLinkCoolify()} disabled={isSubmitting || !coolifySelection.applicationId || !linkedCoolifyProject} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                  <Link2 className="h-4 w-4" />
                  Vincular existente
                </button>
              </div>
              {!selectedApplication.coolifyApplication && createCoolifyEligibility.allowed ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateCoolifyOpen(true)}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Rocket className="h-4 w-4" />
                    Criar no Coolify
                  </button>
                </div>
              ) : null}
              {!selectedApplication.coolifyApplication && !createCoolifyEligibility.allowed && createCoolifyEligibility.reasons.length > 0 ? (
                <div className="mt-4">
                  <Notice type="info" message={createCoolifyEligibility.reasons[0]} />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => void handleReadyCheck()} disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" />
                Validar prontidão
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedApplication) {
                    setIsDetailOpen(false);
                    void openEditForm(selectedApplication);
                  }
                }}
                disabled={isSubmitting || selectedApplication.status === "ARCHIVED"}
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Editar aplicação
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <CreateCoolifyApplicationModal
        application={selectedApplication ?? undefined}
        project={project}
        servers={activeCoolifyServers}
        projects={activeCoolifyProjects}
        hasCoolifyCredential={hasCoolifyCredential}
        isOpen={isCreateCoolifyOpen}
        isSubmitting={isSubmitting}
        onClose={() => (isSubmitting ? undefined : setIsCreateCoolifyOpen(false))}
        onConfirm={(input) => void handleCreateInCoolify(input)}
      />

      <ApplyEnvsCoolifyModal
        application={selectedApplication ?? undefined}
        isOpen={isApplyEnvsOpen}
        isSubmitting={isSubmitting}
        onClose={() => (isSubmitting ? undefined : setIsApplyEnvsOpen(false))}
        onConfirm={(input) => void handleApplyEnvs(input)}
      />

      <DeployCoolifyModal
        application={selectedApplication ?? undefined}
        isOpen={isDeployCoolifyOpen}
        isSubmitting={isSubmitting}
        onClose={() => (isSubmitting ? undefined : setIsDeployCoolifyOpen(false))}
        onConfirm={(input) => void handleDeployCoolify(input)}
      />

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        title="Arquivar aplicação"
        message={`Deseja arquivar ${archiveTarget?.name ?? "esta aplicação"}? Nenhum recurso externo será alterado.`}
        confirmLabel="Arquivar"
        confirmingLabel="Arquivando..."
        onCancel={() => (isSubmitting ? undefined : setArchiveTarget(null))}
        onConfirm={() => void handleArchive()}
        isConfirming={isSubmitting}
        variant="primary"
      />

      <ConfirmDialog
        isOpen={isGenerateDialogOpen}
        title="Gerar .env da aplicação"
        message="Esta ação exibirá variáveis de ambiente e pode revelar credenciais sensíveis."
        warning="Não compartilhe esse conteúdo publicamente e não commite em repositórios."
        confirmLabel="Gerar .env"
        confirmingLabel="Gerando..."
        onCancel={() => (isSubmitting ? undefined : setIsGenerateDialogOpen(false))}
        onConfirm={() => void handleGenerateEnv()}
        isConfirming={isSubmitting}
        variant="primary"
      />
    </section>
  );
}
