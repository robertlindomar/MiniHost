"use client";

import { Clock3, Database, Globe2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuickTemplatesCard } from "@/components/dashboard/QuickTemplatesCard";
import { RecentDnsTable } from "@/components/dashboard/RecentDnsTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatRelativeTime } from "@/components/dashboard/time";
import { Notice } from "@/components/ui/Notice";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { DnsRecord, Domain, HistoryItem } from "@/lib/types";

interface DashboardResponse {
  domains: Domain[];
  records: DnsRecord[];
  history: HistoryItem[];
}

export function DashboardPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        const data = await apiRequest<DashboardResponse>("/api/dashboard");
        setDomains(data.domains);
        setRecords(data.records);
        setHistory(data.history);
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
    <div className="mx-auto max-w-7xl space-y-7">
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

      <QuickTemplatesCard />

      <RecentDnsTable records={latestRecords} domains={domains} isLoading={isLoading} />
    </div>
  );
}
