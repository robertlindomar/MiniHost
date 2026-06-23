"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditLogDetailsDialog } from "@/components/history/AuditLogDetailsDialog";
import { AuditLogFilters, type AuditLogFiltersState } from "@/components/history/AuditLogFilters";
import { AuditLogTable, type SortDirection } from "@/components/history/AuditLogTable";
import { HistoryLoadingState } from "@/components/history/HistoryLoadingState";
import { HistoryPageHeader } from "@/components/history/HistoryPageHeader";
import { HistorySearchInput } from "@/components/history/HistorySearchInput";
import type { PageSize } from "@/components/history/Pagination";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import {
  exportHistoryToCsv,
  matchesActionFilter,
  matchesDateRange,
  matchesEntityFilter,
  matchesSearch,
  matchesUserFilter
} from "@/lib/history";
import type { HistoryItem } from "@/lib/types";

type HistoryResponse = { history: HistoryItem[] };
type ToastState = { type: "success" | "error" | "info"; message: string } | null;

const defaultFilters: AuditLogFiltersState = {
  startDate: "",
  endDate: "",
  actionFilter: "all",
  entityFilter: "all",
  userFilter: "all"
};

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filters, setFilters] = useState<AuditLogFiltersState>(defaultFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedItem, setSelectedItem] = useState<HistoryItem | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  async function loadHistory(mode: "initial" | "refresh" = "initial") {
    try {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const data = await apiRequest<HistoryResponse>("/api/history");
      setHistory(data.history);
      setLoadError(null);

      if (mode === "refresh") {
        setToast({ type: "success", message: "Histórico atualizado com sucesso." });
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Não foi possível carregar o histórico.";

      setLoadError(message);
      setToast({ type: "error", message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadHistory("initial");
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

  const isFiltered = useMemo(() => {
    return (
      searchTerm.trim().length > 0 ||
      filters.startDate !== "" ||
      filters.endDate !== "" ||
      filters.actionFilter !== "all" ||
      filters.entityFilter !== "all" ||
      filters.userFilter !== "all"
    );
  }, [filters, searchTerm]);

  const filteredHistory = useMemo(() => {
    const filtered = history.filter((item) => {
      return (
        matchesSearch(item, searchTerm) &&
        matchesDateRange(item, filters.startDate || undefined, filters.endDate || undefined) &&
        matchesActionFilter(item.action, filters.actionFilter) &&
        matchesEntityFilter(item, filters.entityFilter) &&
        matchesUserFilter(item, filters.userFilter)
      );
    });

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.timestamp).getTime();
      const rightTime = new Date(right.timestamp).getTime();
      return sortDirection === "desc" ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [filters, history, searchTerm, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [filters, searchTerm, pageSize, sortDirection]);

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, page, pageSize]);

  function clearFilters() {
    setFilters(defaultFilters);
    setSearchTerm("");
    setToast({ type: "info", message: "Filtros limpos." });
  }

  async function handleExport() {
    if (filteredHistory.length === 0) {
      setToast({ type: "info", message: "Nenhum registro encontrado." });
      return;
    }

    try {
      setIsExporting(true);
      const csv = exportHistoryToCsv(filteredHistory);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `minihost-historico-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setToast({ type: "success", message: "Exportação iniciada." });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <HistoryPageHeader
        isRefreshing={isRefreshing}
        isExporting={isExporting}
        disableActions={isLoading}
        onRefresh={() => void loadHistory("refresh")}
        onExport={() => void handleExport()}
      />

      <HistorySearchInput value={searchTerm} onChange={setSearchTerm} disabled={isLoading} />

      <AuditLogFilters
        filters={filters}
        history={history}
        disabled={isLoading}
        onChange={setFilters}
        onClear={clearFilters}
      />

      {isLoading ? (
        <HistoryLoadingState />
      ) : loadError && history.length === 0 ? (
        <section className="overflow-hidden rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-soft">
          <p className="text-sm font-semibold text-rose-800">Não foi possível carregar o histórico.</p>
          <p className="mt-2 text-sm text-rose-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadHistory("initial")}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Tentar novamente
          </button>
        </section>
      ) : (
        <AuditLogTable
          items={paginatedHistory}
          totalItems={filteredHistory.length}
          page={page}
          pageSize={pageSize}
          sortDirection={sortDirection}
          isFiltered={isFiltered}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSortDirectionChange={setSortDirection}
          onViewDetails={setSelectedItem}
          onClearFilters={clearFilters}
        />
      )}

      <AuditLogDetailsDialog item={selectedItem} onClose={() => setSelectedItem(undefined)} />

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
