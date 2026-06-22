"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { formatDateTime } from "@/lib/format";
import { initializeMiniHostStorage, loadHistory } from "@/lib/storage";
import type { HistoryItem } from "@/lib/types";

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    initializeMiniHostStorage();
    setHistory(loadHistory());
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
        <p className="mt-1 text-sm text-zinc-500">Eventos salvos no navegador durante o uso do painel.</p>
      </div>

      <DataTable
        columns={columns}
        data={history}
        emptyMessage="Nenhuma ação registrada."
        getRowKey={(item) => item.id}
      />
    </div>
  );
}
