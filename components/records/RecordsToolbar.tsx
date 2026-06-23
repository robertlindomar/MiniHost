"use client";

import { Download, Filter, Plus, Search, Settings2 } from "lucide-react";
import { useState } from "react";
import type { RecordDisplayMode } from "@/components/records/DnsRecordsTable";
import type { RecordVisibilityFilter } from "@/components/records/RecordsFilters";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import type { Domain } from "@/lib/types";

interface RecordsToolbarProps {
  searchTerm: string;
  visibilityFilter: RecordVisibilityFilter;
  domainFilter: string;
  displayMode: RecordDisplayMode;
  domains: Domain[];
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onVisibilityChange: (value: RecordVisibilityFilter) => void;
  onDomainChange: (value: string) => void;
  onDisplayModeChange: (value: RecordDisplayMode) => void;
  onExport: () => void;
  onCreate: () => void;
}

export function RecordsToolbar({
  searchTerm,
  visibilityFilter,
  domainFilter,
  displayMode,
  domains,
  isLoading = false,
  onSearchChange,
  onVisibilityChange,
  onDomainChange,
  onDisplayModeChange,
  onExport,
  onCreate
}: RecordsToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isDisplayOpen, setIsDisplayOpen] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Pesquisar registros de DNS</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchTerm}
            disabled={isLoading}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Pesquisar registros de DNS"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsFiltersOpen((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            type="button"
            onClick={() => setIsDisplayOpen((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Settings2 className="h-4 w-4" />
            Opções de exibição
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            Adicionar registro
          </button>
        </div>
      </div>

      {isFiltersOpen ? (
        <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500" htmlFor="records-visibility-filter">
              Status
            </label>
            <select
              id="records-visibility-filter"
              value={visibilityFilter}
              disabled={isLoading}
              onChange={(event) => onVisibilityChange(event.target.value as RecordVisibilityFilter)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              <option value="active">Ativos</option>
              <option value="deleted">Excluídos</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500" htmlFor="records-domain-filter">
              Domínio
            </label>
            <select
              id="records-domain-filter"
              value={domainFilter}
              disabled={isLoading}
              onChange={(event) => onDomainChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              <option value="all">Todos os domínios</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {isDisplayOpen ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row">
          <button
            type="button"
            onClick={() => onDisplayModeChange("compact")}
            className={`rounded-md border px-4 py-2 text-left text-sm transition ${
              displayMode === "compact"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              Compacta
              <FieldInfoTooltip label="Exibição compacta" description="Menos colunas, ideal para editar rápido." />
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDisplayModeChange("detailed")}
            className={`rounded-md border px-4 py-2 text-left text-sm transition ${
              displayMode === "detailed"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              Detalhada
              <FieldInfoTooltip label="Exibição detalhada" description="Mostra domínio, sincronização, ID e criação." />
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
