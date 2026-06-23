import { Eye, Filter, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { DomainEmptyState } from "@/components/domains/DomainEmptyState";
import { ProviderBadge } from "@/components/domains/ProviderBadge";
import { SearchInput } from "@/components/domains/SearchInput";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { Domain, EntityStatus } from "@/lib/types";

export type DomainStatusFilter = "all" | EntityStatus;

interface DomainTableProps {
  domains: Domain[];
  totalDomains: number;
  searchTerm: string;
  statusFilter: DomainStatusFilter;
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: DomainStatusFilter) => void;
  onCreate: () => void;
  onEdit: (domain: Domain) => void;
  onDelete: (domain: Domain) => void;
}

function ZoneIdCell({ zoneId }: { zoneId?: string }) {
  if (!zoneId) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Ausente
      </div>
    );
  }

  return (
    <span title={zoneId} className="block max-w-[260px] truncate font-mono text-xs text-zinc-500">
      {zoneId}
    </span>
  );
}

export function DomainTable({
  domains,
  totalDomains,
  searchTerm,
  statusFilter,
  isLoading = false,
  onSearchChange,
  onStatusFilterChange,
  onCreate,
  onEdit,
  onDelete
}: DomainTableProps) {
  const isFiltered = searchTerm.trim().length > 0 || statusFilter !== "all";

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-950">Lista de domínios</p>
          <p className="mt-1 text-xs text-zinc-500">
            Mostrando {domains.length} de {totalDomains} {totalDomains === 1 ? "domínio" : "domínios"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={searchTerm} onChange={onSearchChange} disabled={isLoading} />
          <label className="relative block">
            <span className="sr-only">Filtrar por status</span>
            <select
              value={statusFilter}
              disabled={isLoading}
              onChange={(event) => onStatusFilterChange(event.target.value as DomainStatusFilter)}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 pr-9 text-sm text-zinc-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 sm:w-44"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
            <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </label>
        </div>
      </div>

      {domains.length === 0 ? (
        <DomainEmptyState
          title={isFiltered ? "Nenhum domínio encontrado" : "Nenhum domínio cadastrado"}
          description={
            isFiltered
              ? "Ajuste a busca ou o filtro para encontrar o domínio desejado."
              : "Adicione seu primeiro domínio para começar a gerenciar registros DNS."
          }
          actionLabel={isFiltered ? undefined : "Novo domínio"}
          onAction={isFiltered ? undefined : onCreate}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full border-collapse">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs font-semibold text-zinc-500">
                <th className="px-4 py-3">Domínio</th>
                <th className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    Zone ID
                    <FieldInfoTooltip
                      label="Zone ID"
                      description="Necessário para sincronizar registros com a Cloudflare. Encontre no painel da Cloudflare."
                    />
                  </span>
                </th>
                <th className="px-4 py-3">Provedor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {domains.map((domain) => (
                <tr key={domain.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-zinc-950">{domain.name}</div>
                  </td>
                  <td className="px-4 py-4">
                    <ZoneIdCell zoneId={domain.zoneId} />
                  </td>
                  <td className="px-4 py-4">
                    <ProviderBadge provider={domain.provider} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={domain.status} />
                  </td>
                  <td className="px-4 py-4 text-zinc-600">{formatDateTime(domain.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/records?domain=${domain.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver registros
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(domain)}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(domain)}
                        className="inline-flex items-center justify-center rounded-md border border-rose-100 bg-rose-50 px-2.5 py-2 text-rose-700 transition hover:bg-rose-100"
                        aria-label={`Excluir ${domain.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md px-2 py-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Mais ações para ${domain.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
