import type { AuditActionFilter, AuditEntityFilter, AuditUserFilter } from "@/lib/history";
import type { HistoryItem } from "@/lib/types";
import { getUniqueUsers } from "@/lib/history";
import { CalendarDays } from "lucide-react";

export interface AuditLogFiltersState {
  startDate: string;
  endDate: string;
  actionFilter: AuditActionFilter;
  entityFilter: AuditEntityFilter;
  userFilter: AuditUserFilter;
}

interface AuditLogFiltersProps {
  filters: AuditLogFiltersState;
  history: HistoryItem[];
  disabled?: boolean;
  onChange: (filters: AuditLogFiltersState) => void;
  onClear: () => void;
}

const selectClassName =
  "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400";

const inputClassName =
  "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400";

export function AuditLogFilters({ filters, history, disabled = false, onChange, onClear }: AuditLogFiltersProps) {
  const users = getUniqueUsers(history);

  function update<K extends keyof AuditLogFiltersState>(key: K, value: AuditLogFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block min-w-0">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <CalendarDays className="h-3.5 w-3.5" />
                Período inicial
              </span>
              <input
                type="date"
                disabled={disabled}
                value={filters.startDate}
                onChange={(event) => update("startDate", event.target.value)}
                className={`${inputClassName} w-full`}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Período final</span>
              <input
                type="date"
                disabled={disabled}
                value={filters.endDate}
                onChange={(event) => update("endDate", event.target.value)}
                className={`${inputClassName} w-full`}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Tipo de ação</span>
              <select
                disabled={disabled}
                value={filters.actionFilter}
                onChange={(event) => update("actionFilter", event.target.value as AuditActionFilter)}
                className={`${selectClassName} w-full`}
              >
                <option value="all">Todas as ações</option>
                <option value="create">Criação</option>
                <option value="update">Atualização</option>
                <option value="delete">Exclusão</option>
                <option value="sync">Sincronização</option>
                <option value="template">Template</option>
                <option value="error">Erro</option>
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Entidade</span>
              <select
                disabled={disabled}
                value={filters.entityFilter}
                onChange={(event) => update("entityFilter", event.target.value as AuditEntityFilter)}
                className={`${selectClassName} w-full`}
              >
                <option value="all">Todas as entidades</option>
                <option value="domain">Domínio</option>
                <option value="record">Registro DNS</option>
                <option value="project">Projeto</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="template">Template DNS</option>
                <option value="settings">Configuração</option>
                <option value="system">Usuário/Sistema</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 sm:min-w-56">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Usuário</span>
              <select
                disabled={disabled}
                value={filters.userFilter}
                onChange={(event) => update("userFilter", event.target.value as AuditUserFilter)}
                className={`${selectClassName} w-full`}
              >
                <option value="all">Todos os usuários</option>
                <option value="system">Sistema</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
