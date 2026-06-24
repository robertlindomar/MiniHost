"use client";

import { Clock3, Database, FolderKanban, Globe2, Layers3, Link2Off, Rocket, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuickTemplatesCard } from "@/components/dashboard/QuickTemplatesCard";
import { RecentDnsTable } from "@/components/dashboard/RecentDnsTable";
import { RecentProjectsSection } from "@/components/dashboard/RecentProjectsSection";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatRelativeTime } from "@/components/dashboard/time";
import { Notice } from "@/components/ui/Notice";
import { pageContainerClass } from "@/components/layout/page-container";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { DnsRecord, Domain, HistoryItem, Project, ProjectDatabase } from "@/lib/types";

interface DashboardResponse {
  domains: Domain[];
  records: DnsRecord[];
  projects: Project[];
  databases: ProjectDatabase[];
  history: HistoryItem[];
  coolifySummary?: {
    activeResources: number;
    missingResources: number;
    removedResources: number;
    brokenProjectLinks: number;
  };
  applicationSummary?: {
    planned: number;
    ready: number;
    linkedToCoolify: number;
    withoutDomain: number;
  };
}

export function DashboardPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [databases, setDatabases] = useState<ProjectDatabase[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [coolifySummary, setCoolifySummary] = useState({
    activeResources: 0,
    missingResources: 0,
    removedResources: 0,
    brokenProjectLinks: 0
  });
  const [applicationSummary, setApplicationSummary] = useState({
    planned: 0,
    ready: 0,
    linkedToCoolify: 0,
    withoutDomain: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        const data = await apiRequest<DashboardResponse>("/api/dashboard");
        setDomains(data.domains);
        setRecords(data.records);
        setProjects(data.projects);
        setDatabases(data.databases);
        setHistory(data.history);
        setCoolifySummary(
          data.coolifySummary ?? {
            activeResources: 0,
            missingResources: 0,
            removedResources: 0,
            brokenProjectLinks: 0
          }
        );
        setApplicationSummary(
          data.applicationSummary ?? {
            planned: 0,
            ready: 0,
            linkedToCoolify: 0,
            withoutDomain: 0
          }
        );
        setError(null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const activeRecords = useMemo(() => records.filter((record) => record.status === "active"), [records]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "ACTIVE"), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.status === "ARCHIVED"), [projects]);
  const recordsWithoutProject = useMemo(
    () => activeRecords.filter((record) => !record.projectId),
    [activeRecords]
  );
  const plannedDatabases = useMemo(
    () => databases.filter((database) => database.status === "PLANNED"),
    [databases]
  );
  const activeDatabases = useMemo(
    () => databases.filter((database) => database.status === "ACTIVE"),
    [databases]
  );
  const failedDatabases = useMemo(
    () => databases.filter((database) => database.status === "FAILED"),
    [databases]
  );
  const projectsWithoutActiveDatabase = useMemo(() => {
    const activeDbProjectIds = new Set(
      databases.filter((database) => database.status === "ACTIVE").map((database) => database.projectId)
    );

    return projects.filter((project) => project.status !== "ARCHIVED" && !activeDbProjectIds.has(project.id));
  }, [projects, databases]);

  const latestRecords = useMemo(
    () => [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [records]
  );

  const latestHistory = useMemo(
    () => [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0],
    [history]
  );

  const proxyPercentage = useMemo(() => {
    if (activeRecords.length === 0) {
      return 0;
    }

    const proxiedRecords = activeRecords.filter((record) => record.proxied).length;
    return Math.round((proxiedRecords / activeRecords.length) * 100);
  }, [activeRecords]);

  return (
    <div className={pageContainerClass}>
      <PageHeader
        title="Visão geral"
        description="Bem-vindo ao MiniHost. Gerencie seus domínios, registros DNS e integrações de infraestrutura de forma simples, segura e eficiente."
      />

      {error ? <Notice type="error" message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total de domínios"
          value={domains.length}
          description="Domínios cadastrados no painel"
          icon={<Globe2 className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Total de registros DNS"
          value={activeRecords.length}
          description="Registros locais e sincronizados"
          icon={<Database className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
        <StatCard
          title="Proxy ativo"
          value={`${proxyPercentage}%`}
          description="Tráfego protegido pela Cloudflare"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          title="Última alteração"
          value={latestHistory ? formatRelativeTime(latestHistory.timestamp) : "Nenhuma alteração"}
          description={latestHistory ? formatDateTime(latestHistory.timestamp) : "Histórico sem eventos"}
          icon={<Clock3 className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total de projetos"
          value={projects.length}
          description="Projetos cadastrados no painel"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Projetos ativos"
          value={activeProjects.length}
          description="Projetos em operação"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          title="Projetos arquivados"
          value={archivedProjects.length}
          description="Projetos arquivados sem exclusão"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
        <StatCard
          title="DNS sem projeto"
          value={recordsWithoutProject.length}
          description="Registros ainda não agrupados"
          icon={<Link2Off className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Bancos planejados"
          value={plannedDatabases.length}
          description="Bancos PostgreSQL registrados como planejados"
          icon={<Server className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Bancos ativos"
          value={activeDatabases.length}
          description="Bancos com status ativo"
          icon={<Database className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          title="Bancos com erro"
          value={failedDatabases.length}
          description="Bancos com falha no provisionamento"
          icon={<Server className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
        <StatCard
          title="Projetos sem banco ativo"
          value={projectsWithoutActiveDatabase.length}
          description="Projetos sem banco PostgreSQL ativo"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Aplicações planejadas"
          value={applicationSummary.planned}
          description="Apps configurados dentro dos projetos"
          icon={<Layers3 className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Aplicações prontas"
          value={applicationSummary.ready}
          description="Apps prontos para provisionamento futuro"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          title="Apps vinculados ao Coolify"
          value={applicationSummary.linkedToCoolify}
          description="Aplicações planejadas com vínculo local"
          icon={<Rocket className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
        <StatCard
          title="Apps sem domínio"
          value={applicationSummary.withoutDomain}
          description="Aplicações sem domínio definido"
          icon={<Globe2 className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Recursos Coolify ativos"
          value={coolifySummary.activeResources}
          description="Servidores, projetos e aplicações encontrados"
          icon={<Rocket className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          title="Recursos Coolify ausentes"
          value={coolifySummary.missingResources}
          description="Não vieram na última sincronização"
          icon={<FolderKanban className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
        <StatCard
          title="Recursos Coolify removidos"
          value={coolifySummary.removedResources}
          description="Mantidos apenas no histórico local"
          icon={<Link2Off className="h-5 w-5" />}
          tone="violet"
          isLoading={isLoading}
        />
        <StatCard
          title="Projetos com vínculo quebrado"
          value={coolifySummary.brokenProjectLinks}
          description="Projetos MiniHost vinculados a recurso ausente/removido"
          icon={<Link2Off className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
        />
      </section>

      <RecentProjectsSection projects={projects} isLoading={isLoading} />

      <QuickTemplatesCard />

      <RecentDnsTable records={latestRecords} domains={domains} isLoading={isLoading} />
    </div>
  );
}
