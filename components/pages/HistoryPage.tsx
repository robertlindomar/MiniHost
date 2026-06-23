"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { HistoryItem } from "@/lib/types";

type HistoryResponse = { history: HistoryItem[] };

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        const data = await apiRequest<HistoryResponse>("/api/history");
        setHistory(data.history);
        setError(null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o histórico.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadHistory();
  }, []);

  const columns: TableColumn<HistoryItem>[] = [
    {
      header: "Ação",
      cell: (item) => <Badge variant={item.action.includes("excluído") ? "danger" : "info"}>{item.action}</Badge>
    },
    {
      header: "Entidade afetada",
      cell: (item) => <span className="font-medium text-zinc-950">{item.entityName}</span>
    },
    {
      header: "Data/hora",
      cell: (item) => formatDateTime(item.timestamp)
    },
    {
      header: "Descrição",
      cell: (item) => <span className="text-zinc-600">{item.description}</span>
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Histórico de ações</h2>
        <p className="mt-1 text-sm text-zinc-500">Eventos salvos no banco durante o uso do painel.</p>
      </div>

      {error ? <Notice type="error" message={error} /> : null}
      {isLoading ? <Notice type="info" message="Carregando histórico..." /> : null}

      <DataTable
        columns={columns}
        data={history}
        emptyMessage="Nenhuma ação registrada."
        getRowKey={(item) => item.id}
      />
    </div>
  );
}
