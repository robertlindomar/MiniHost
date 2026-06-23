import type { Domain } from "@/lib/types";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";

export type RecordVisibilityFilter = "active" | "deleted" | "all";

interface RecordsFiltersProps {
  visibilityFilter: RecordVisibilityFilter;
  domainFilter: string;
  domains: Domain[];
  isLoading?: boolean;
  onVisibilityChange: (value: RecordVisibilityFilter) => void;
  onDomainChange: (value: string) => void;
}

export function RecordsFilters({
  visibilityFilter,
  domainFilter,
  domains,
  isLoading = false,
  onVisibilityChange,
  onDomainChange
}: RecordsFiltersProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-950">Filtros</p>
          <FieldInfoTooltip label="Filtros" description="Refine a lista por status e domínio." />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={visibilityFilter}
            disabled={isLoading}
            onChange={(event) => onVisibilityChange(event.target.value as RecordVisibilityFilter)}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
          >
            <option value="active">Ativos</option>
            <option value="deleted">Excluídos</option>
            <option value="all">Todos</option>
          </select>
          <select
            value={domainFilter}
            disabled={isLoading}
            onChange={(event) => onDomainChange(event.target.value)}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 sm:min-w-64"
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
    </section>
  );
}
