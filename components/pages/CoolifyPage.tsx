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
};

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

export function CoolifyPage() {
  const [coolify, setCoolify] = useState<CoolifyStatus>(defaultCoolify);
  const [servers, setServers] = useState<CoolifyServerCache[]>([]);
  const [projects, setProjects] = useState<CoolifyProjectCache[]>([]);
  const [applications, setApplications] = useState<CoolifyApplicationCache[]>([]);
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
    { header: "Status", cell: (server) => server.status ? <Badge variant="info">{server.status}</Badge> : "-" },
    { header: "Última sincronização", cell: (server) => formatDateTime(server.lastSyncedAt) }
  ];

  const projectColumns: TableColumn<CoolifyProjectCache>[] = [
    { header: "Projeto", cell: (project) => <span className="font-semibold text-zinc-950">{project.name}</span> },
    { header: "Descrição", cell: (project) => project.description || "-" },
    { header: "ID Coolify", cell: (project) => <span className="font-mono text-xs">{project.coolifyId}</span> },
    { header: "Última sincronização", cell: (project) => formatDateTime(project.lastSyncedAt) }
  ];

  const applicationColumns: TableColumn<CoolifyApplicationCache>[] = [
    {
      header: "Aplicação",
      cell: (application) => <span className="font-semibold text-zinc-950">{application.name}</span>
    },
    { header: "FQDN", cell: (application) => application.fqdn || "-" },
    { header: "Status", cell: (application) => application.status ? <Badge variant="info">{application.status}</Badge> : "-" },
    { header: "Repositório", cell: (application) => application.gitRepository || "-" },
    { header: "Branch", cell: (application) => application.branch || "-" },
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
          title="Servidores"
          value={servers.length}
          description="Servidores sincronizados"
          icon={<Server className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Projetos Coolify"
          value={projects.length}
          description="Projetos em cache local"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
        <StatCard
          title="Aplicações"
          value={applications.length}
          description={lastSync ? `Última sync: ${formatDateTime(lastSync)}` : "Nenhuma sync registrada"}
          icon={<Layers3 className="h-5 w-5" />}
          tone="emerald"
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

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-950">Servidores</h3>
        <DataTable
          columns={serverColumns}
          data={servers}
          emptyMessage="Nenhum servidor sincronizado."
          getRowKey={(server) => server.id}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-950">Projetos</h3>
        <DataTable
          columns={projectColumns}
          data={projects}
          emptyMessage="Nenhum projeto Coolify sincronizado."
          getRowKey={(project) => project.id}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-950">Aplicações</h3>
        <DataTable
          columns={applicationColumns}
          data={applications}
          emptyMessage="Nenhuma aplicação sincronizada."
          getRowKey={(application) => application.id}
        />
      </section>
    </div>
  );
}
