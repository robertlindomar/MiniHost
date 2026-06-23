import { Archive, Eye, Filter, MoreVertical, Pencil } from "lucide-react";
import Link from "next/link";
import { SearchInput } from "@/components/domains/SearchInput";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { DomainEmptyState } from "@/components/domains/DomainEmptyState";
import { formatDateTime } from "@/lib/format";
import type { Project, ProjectStatus } from "@/lib/types";

export type ProjectStatusFilter = "all" | ProjectStatus;

interface ProjectTableProps {
  projects: Project[];
  totalProjects: number;
  searchTerm: string;
  statusFilter: ProjectStatusFilter;
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: ProjectStatusFilter) => void;
  onCreate: () => void;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
}

export function ProjectTable({
  projects,
  totalProjects,
  searchTerm,
  statusFilter,
  isLoading = false,
  onSearchChange,
  onStatusFilterChange,
  onCreate,
  onEdit,
  onArchive
}: ProjectTableProps) {
  const isFiltered = searchTerm.trim().length > 0 || statusFilter !== "all";

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-950">Lista de projetos</p>
          <p className="mt-1 text-xs text-zinc-500">
            Mostrando {projects.length} de {totalProjects} {totalProjects === 1 ? "projeto" : "projetos"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={searchTerm} onChange={onSearchChange} disabled={isLoading} />
          <label className="relative block">
            <span className="sr-only">Filtrar por status</span>
            <select
              value={statusFilter}
              disabled={isLoading}
              onChange={(event) => onStatusFilterChange(event.target.value as ProjectStatusFilter)}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 pr-9 text-sm text-zinc-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 sm:w-44"
            >
              <option value="all">Todos os status</option>
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
            <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </label>
        </div>
      </div>

      {projects.length === 0 ? (
        <DomainEmptyState
          title={isFiltered ? "Nenhum projeto encontrado" : "Nenhum projeto cadastrado"}
          description={
            isFiltered
              ? "Ajuste a busca ou o filtro para encontrar o projeto desejado."
              : "Crie seu primeiro projeto para agrupar registros DNS de um mesmo sistema."
          }
          actionLabel={isFiltered ? undefined : "Novo projeto"}
          onAction={isFiltered ? undefined : onCreate}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs font-semibold text-zinc-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Domínio principal</th>
                <th className="px-4 py-3">Recursos</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {projects.map((project) => (
                <tr key={project.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-zinc-950">{project.name}</div>
                    <p className="mt-1 text-xs text-zinc-500">
                      DNS: {project.recordCount ?? 0} · DB: {project.databaseCount ?? 0}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-zinc-600">{project.slug}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="block max-w-[240px] truncate text-zinc-600">{project.description || "—"}</span>
                  </td>
                  <td className="px-4 py-4">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-4 text-zinc-600">{project.mainDomain || "—"}</td>
                  <td className="px-4 py-4 text-zinc-600">
                    <span className="inline-flex flex-col gap-1 text-xs">
                      <span>DNS: {project.recordCount ?? 0}</span>
                      <span>DB: {project.databaseCount ?? 0}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">{formatDateTime(project.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalhes
                      </Link>
                      {project.status !== "ARCHIVED" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(project)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchive(project)}
                            className="inline-flex items-center justify-center rounded-md border border-amber-100 bg-amber-50 px-2.5 py-2 text-amber-700 transition hover:bg-amber-100"
                            aria-label={`Arquivar ${project.name}`}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md px-2 py-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Mais ações para ${project.name}`}
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
