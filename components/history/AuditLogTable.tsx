"use client";

import { ArrowDown, ArrowUp, Eye, MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { AuditActionBadge } from "@/components/history/AuditActionBadge";
import { EntityBadge } from "@/components/history/EntityBadge";
import { HistoryEmptyState } from "@/components/history/HistoryEmptyState";
import { Pagination } from "@/components/history/Pagination";
import { UserAvatar } from "@/components/history/UserAvatar";
import { formatAuditDateTime } from "@/lib/format";
import type { HistoryItem } from "@/lib/types";
import type { PageSize } from "@/components/history/Pagination";

export type SortDirection = "desc" | "asc";

interface AuditLogTableProps {
  items: HistoryItem[];
  totalItems: number;
  page: number;
  pageSize: PageSize;
  sortDirection: SortDirection;
  isFiltered?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onViewDetails: (item: HistoryItem) => void;
  onClearFilters?: () => void;
}

export function AuditLogTable({
  items,
  totalItems,
  page,
  pageSize,
  sortDirection,
  isFiltered = false,
  onPageChange,
  onPageSizeChange,
  onSortDirectionChange,
  onViewDetails,
  onClearFilters
}: AuditLogTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (!target?.closest("[data-audit-row-menu]")) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openMenuId]);

  if (items.length === 0) {
    return (
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
        <HistoryEmptyState
          title={isFiltered ? "Nenhum registro encontrado" : "Nenhuma ação registrada"}
          description={
            isFiltered
              ? "Nenhuma ação corresponde aos filtros selecionados."
              : "As ações realizadas no MiniHost aparecerão aqui para auditoria."
          }
          actionLabel={isFiltered ? "Limpar filtros" : undefined}
          onAction={isFiltered ? onClearFilters : undefined}
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full border-collapse">
          <thead className="bg-zinc-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade afetada</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Email do usuário</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSortDirectionChange(sortDirection === "desc" ? "asc" : "desc")}
                  className="inline-flex items-center gap-1.5 transition hover:text-zinc-800"
                >
                  Data/hora
                  {sortDirection === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                </button>
              </th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onViewDetails(item)}
                className="cursor-pointer border-t border-zinc-100 transition hover:bg-zinc-50/80"
              >
                <td className="px-4 py-4 align-top">
                  <AuditActionBadge action={item.action} />
                </td>
                <td className="px-4 py-4 align-top">
                  <EntityBadge item={item} />
                </td>
                <td className="px-4 py-4 align-top">
                  <UserAvatar item={item} />
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="max-w-[180px] truncate text-xs text-zinc-500">{item.userEmail ?? "—"}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="whitespace-nowrap text-sm text-zinc-700">{formatAuditDateTime(item.timestamp)}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="max-w-xs truncate text-sm text-zinc-600" title={item.description}>
                    {item.description}
                  </p>
                </td>
                <td className="relative px-4 py-4 align-top text-right" data-audit-row-menu>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((current) => (current === item.id ? null : item.id));
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label="Abrir ações do evento"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {openMenuId === item.id ? (
                    <div className="absolute right-4 top-12 z-10 min-w-40 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId(null);
                          onViewDetails(item);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                        Ver detalhes
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
