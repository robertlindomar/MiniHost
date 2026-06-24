"use client";

import { FolderKanban, Layers3, Loader2, RefreshCw, Rocket, Server } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { pageContainerClass } from "@/components/layout/page-container";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type {
  CoolifyApplicationCache,
  CoolifyCacheStatus,
  CoolifyProjectCache,
  CoolifyServerCache,
  CoolifyStatus
} from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;

type CoolifyResponse = {
  coolify: CoolifyStatus;
  servers: CoolifyServerCache[];
  projects: CoolifyProjectCache[];
  applications: CoolifyApplicationCache[];
};

type CoolifySyncResponse = CoolifyResponse & {
  message: string;
  syncedAt: string;
  imported: {
    servers: number;
    projects: number;
    applications: number;
  };
  reconciliation?: {
    servers: { active: number; missing: number; removed: number };
    projects: { active: number; missing: number; removed: number };
    applications: { active: number; missing: number; removed: number };
  };
};

type ResourceFilter = "ACTIVE" | "MISSING" | "REMOVED" | "ALL";

const defaultCoolify: CoolifyStatus = {
  hasCredential: false,
  connectionStatus: "not_configured"
};

function connectionBadge(status: CoolifyStatus["connectionStatus"]) {
  if (status === "connected") {
    return <Badge variant="success">Conectado</Badge>;
  }

  if (status === "error") {
    return <Badge variant="danger">Erro no último teste</Badge>;
  }

  if (status === "not_tested") {
    return <Badge variant="info">Não testado</Badge>;
  }

  return <Badge variant="warning">Não configurado</Badge>;
}

function findLastSync(items: Array<{ lastSyncedAt?: string }>) {
  const sorted = items
    .map((item) => item.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a));

  return sorted[0];
}

function cacheStatusBadge(status: CoolifyCacheStatus) {
  if (status === "ACTIVE") {
    return <Badge variant="success">Ativo</Badge>;
  }

  if (status === "MISSING") {
    return <Badge variant="warning">Não encontrado na última sincronização</Badge>;
  }

  if (status === "REMOVED") {
    return <Badge variant="danger">Removido no Coolify</Badge>;
  }

  return <Badge variant="danger">Erro</Badge>;
}

function statusHelp(status: CoolifyCacheStatus) {
  if (status === "MISSING") {
    return "Este recurso existe apenas no histórico local do MiniHost. Ele não foi encontrado no Coolify na última sincronização.";
  }

  if (status === "REMOVED") {
    return "Este recurso existe apenas no histórico local do MiniHost. Ele não foi encontrado novamente e parece ter sido removido no Coolify.";
  }

  return null;
}

function filterResources<T extends { status: CoolifyCacheStatus }>(items: T[], filter: ResourceFilter) {
  return filter === "ALL" ? items : items.filter((item) => item.status === filter);
}

export function CoolifyPage() {
  const [coolify, setCoolify] = useState<CoolifyStatus>(defaultCoolify);
  const [servers, setServers] = useState<CoolifyServerCache[]>([]);
  const [projects, setProjects] = useState<CoolifyProjectCache[]>([]);
  const [applications, setApplications] = useState<CoolifyApplicationCache[]>([]);
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("ACTIVE");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  async function loadCoolify() {
    try {
      setIsLoading(true);
      const data = await apiRequest<CoolifyResponse>("/api/coolify");
      setCoolify(data.coolify ?? defaultCoolify);
      setServers(data.servers);
      setProjects(data.projects);
      setApplications(data.applications);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar dados do Coolify.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCoolify();
  }, []);

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

  const lastSync = useMemo(
    () => findLastSync([...servers, ...projects, ...applications]),
    [servers, projects, applications]
  );

  const filteredServers = useMemo(() => filterResources(servers, resourceFilter), [servers, resourceFilter]);
  const filteredProjects = useMemo(() => filterResources(projects, resourceFilter), [projects, resourceFilter]);
  const filteredApplications = useMemo(
    () => filterResources(applications, resourceFilter),
    [applications, resourceFilter]
  );

  const resourceTotals = useMemo(() => {
    const all = [...servers, ...projects, ...applications];
    return {
      active: all.filter((item) => item.status === "ACTIVE").length,
      missing: all.filter((item) => item.status === "MISSING").length,
      removed: all.filter((item) => item.status === "REMOVED").length
    };
  }, [servers, projects, applications]);

  async function handleSync() {
    try {
      setIsSyncing(true);
      const data = await apiRequest<CoolifySyncResponse>("/api/coolify/sync", {
        method: "POST"
      });
      setServers(data.servers);
      setProjects(data.projects);
      setApplications(data.applications);
      setCoolify((current) => ({
        ...current,
        connectionStatus: "connected",
        lastTestedAt: data.syncedAt,
        lastTestMessage: data.message
      }));
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível sincronizar recursos do Coolify.";
      setCoolify((current) => ({
        ...current,
        connectionStatus: "error",
        lastTestedAt: new Date().toISOString(),
        lastTestMessage: message
      }));
      setToast({ type: "error", message });
    } finally {
      setIsSyncing(false);
    }
  }

  const serverColumns: TableColumn<CoolifyServerCache>[] = [
    { header: "Servidor", cell: (server) => <span className="font-semibold text-zinc-950">{server.name}</span> },
    { header: "IP", cell: (server) => server.ip || "-" },
    {
      header: "Estado local",
      cell: (server) => (
        <div className="space-y-1">
          {cacheStatusBadge(server.status)}
          {statusHelp(server.status) ? <p className="max-w-xs text-xs text-zinc-500">{statusHelp(server.status)}</p> : null}
        </div>
      )
    },
    { header: "Status remoto", cell: (server) => server.remoteStatus ? <Badge variant="info">{server.remoteStatus}</Badge> : "-" },
    { header: "Última presença", cell: (server) => formatDateTime(server.lastSeenAt) },
    { header: "Última sincronização", cell: (server) => formatDateTime(server.lastSyncedAt) }
  ];

  const projectColumns: TableColumn<CoolifyProjectCache>[] = [
    { header: "Projeto", cell: (project) => <span className="font-semibold text-zinc-950">{project.name}</span> },
    { header: "Descrição", cell: (project) => project.description || "-" },
    {
      header: "Estado local",
      cell: (project) => (
        <div className="space-y-1">
          {cacheStatusBadge(project.status)}
          {statusHelp(project.status) ? <p className="max-w-xs text-xs text-zinc-500">{statusHelp(project.status)}</p> : null}
        </div>
      )
    },
    { header: "Status remoto", cell: (project) => project.remoteStatus ? <Badge variant="info">{project.remoteStatus}</Badge> : "-" },
    { header: "ID Coolify", cell: (project) => <span className="font-mono text-xs">{project.coolifyId}</span> },
    { header: "Última presença", cell: (project) => formatDateTime(project.lastSeenAt) },
    { header: "Última sincronização", cell: (project) => formatDateTime(project.lastSyncedAt) }
  ];

  const applicationColumns: TableColumn<CoolifyApplicationCache>[] = [
    {
      header: "Aplicação",
      cell: (application) => <span className="font-semibold text-zinc-950">{application.name}</span>
    },
    { header: "FQDN", cell: (application) => application.fqdn || "-" },
    {
      header: "Estado local",
      cell: (application) => (
        <div className="space-y-1">
          {cacheStatusBadge(application.status)}
          {statusHelp(application.status) ? <p className="max-w-xs text-xs text-zinc-500">{statusHelp(application.status)}</p> : null}
        </div>
      )
    },
    { header: "Status remoto", cell: (application) => application.remoteStatus ? <Badge variant="info">{application.remoteStatus}</Badge> : "-" },
    { header: "Repositório", cell: (application) => application.gitRepository || "-" },
    { header: "Branch", cell: (application) => application.branch || "-" },
    { header: "Última presença", cell: (application) => formatDateTime(application.lastSeenAt) },
    { header: "Última sincronização", cell: (application) => formatDateTime(application.lastSyncedAt) }
  ];

  return (
    <div className={pageContainerClass}>
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <PageHeader
        title="Coolify"
        description="Visualize servidores, projetos e aplicações sincronizados do Coolify em modo somente leitura."
        action={
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={isSyncing || !coolify.hasCredential}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isSyncing ? "Sincronizando..." : "Sincronizar recursos"}
          </button>
        }
      />

      {error ? <Notice type="error" message={error} /> : null}

      {!coolify.hasCredential ? (
        <Notice
          type="info"
          message="Configure a URL base e o token do Coolify em Configurações antes de sincronizar recursos."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Status Coolify"
          value={coolify.connectionStatus === "connected" ? "Conectado" : "Pendente"}
          description={coolify.baseUrl || "Configure a URL base em Configurações"}
          icon={<Rocket className="h-5 w-5" />}
          tone={coolify.connectionStatus === "connected" ? "emerald" : "amber"}
          isLoading={isLoading}
        />
        <StatCard
          title="Recursos ativos"
          value={resourceTotals.active}
          description="Servidores, projetos e aplicações encontrados"
          icon={<Server className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Recursos ausentes"
          value={resourceTotals.missing}
          description="Não encontrados na última sincronização"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
        <StatCard
          title="Recursos removidos"
          value={resourceTotals.removed}
          description={lastSync ? `Última sync: ${formatDateTime(lastSync)}` : "Nenhuma sync registrada"}
          icon={<Layers3 className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Conexão</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Token protegido no backend. Esta página não executa ações de deploy, edição ou exclusão.
            </p>
          </div>
          {connectionBadge(coolify.connectionStatus)}
        </div>
        {coolify.lastTestedAt ? (
          <p className="mt-4 text-sm text-zinc-600">
            Último teste: {formatDateTime(coolify.lastTestedAt)}
            {coolify.lastTestMessage ? ` · ${coolify.lastTestMessage}` : ""}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">Filtro de recursos</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Por padrão, recursos removidos no Coolify ficam ocultos da listagem ativa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[
              ["ACTIVE", "Ativos"],
              ["MISSING", "Ausentes"],
              ["REMOVED", "Removidos"],
              ["ALL", "Todos"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setResourceFilter(value as ResourceFilter)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  resourceFilter === value
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-950">Servidores</h3>
        <DataTable
          columns={serverColumns}
          data={filteredServers}
          emptyMessage="Nenhum servidor sincronizado."
          getRowKey={(server) => server.id}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-950">Projetos</h3>
        <DataTable
          columns={projectColumns}
          data={filteredProjects}
          emptyMessage="Nenhum projeto Coolify sincronizado."
          getRowKey={(project) => project.id}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-950">Aplicações</h3>
        <DataTable
          columns={applicationColumns}
          data={filteredApplications}
          emptyMessage="Nenhuma aplicação sincronizada."
          getRowKey={(application) => application.id}
        />
      </section>
    </div>
  );
}
