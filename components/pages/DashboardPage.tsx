"use client";

import { Activity, Clock3, Globe2, RadioTower } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { StatCard } from "@/components/ui/StatCard";
import { DnsTemplatesPanel } from "@/components/templates/DnsTemplatesPanel";
import { formatDateTime, formatRecordValue, formatTtl } from "@/lib/format";
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

  const latestRecords = useMemo(
    () => [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6),
    [records]
  );

  const latestHistory = useMemo(
    () => [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0],
    [history]
  );

  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain.name])), [domains]);

  const columns: TableColumn<DnsRecord>[] = [
    {
      header: "Tipo",
      cell: (record) => <Badge variant="info">{record.type}</Badge>
    },
    {
      header: "Nome",
      cell: (record) => <span className="font-medium text-zinc-900">{record.name}</span>
    },
    {
      header: "Valor",
      cell: (record) => <span className="break-all">{formatRecordValue(record)}</span>
    },
    {
      header: "Domínio",
      cell: (record) => domainById.get(record.domainId) ?? "Domínio removido"
    },
    {
      header: "TTL",
      cell: (record) => formatTtl(record.ttl)
    },
    {
      header: "Atualizado",
      cell: (record) => formatDateTime(record.updatedAt)
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section>
        <h2 className="text-xl font-semibold text-zinc-950">Visão geral</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Painel simples para organizar domínios, subdomínios e registros DNS da sua VPS.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total de domínios" value={domains.length} icon={<Globe2 className="h-5 w-5" />} />
        <StatCard title="Total de registros DNS" value={records.length} icon={<RadioTower className="h-5 w-5" />} />
        <StatCard
          title="Registros com proxy ativo"
          value={records.filter((record) => record.proxied).length}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Última alteração"
          value={latestHistory ? formatDateTime(latestHistory.timestamp) : "-"}
          description={latestHistory?.action}
          icon={<Clock3 className="h-5 w-5" />}
        />
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Templates rápidos</h2>
          <p className="mt-1 text-sm text-zinc-500">Crie registros comuns usando domínio e IP padrão das configurações.</p>
        </div>
        <DnsTemplatesPanel mode="quick" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Últimos registros criados/editados</h2>
            <p className="mt-1 text-sm text-zinc-500">Dados carregados do PostgreSQL.</p>
          </div>
        </div>

        {error ? <Notice type="error" message={error} /> : null}
        {isLoading ? <Notice type="info" message="Carregando dados do dashboard..." /> : null}

        <DataTable
          columns={columns}
          data={latestRecords}
          emptyMessage="Nenhum registro DNS cadastrado."
          getRowKey={(record) => record.id}
        />
      </section>
    </div>
  );
}
