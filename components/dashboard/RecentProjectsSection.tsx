import { ArrowRight, FolderKanban } from "lucide-react";
import Link from "next/link";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { formatDateTime } from "@/lib/format";
import type { Project } from "@/lib/types";

interface RecentProjectsSectionProps {
  projects: Project[];
  isLoading?: boolean;
}

export function RecentProjectsSection({ projects, isLoading = false }: RecentProjectsSectionProps) {
  const recentProjects = [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Projetos recentes</h2>
          <p className="mt-1 text-sm text-zinc-500">Últimos projetos cadastrados no painel</p>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 rounded-md bg-zinc-100" />
          ))}
        </div>
      ) : recentProjects.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-500">
            <FolderKanban className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm text-zinc-500">Nenhum projeto cadastrado ainda.</p>
          <Link
            href="/projects"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Criar primeiro projeto
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs font-semibold text-zinc-500">
                <th className="px-5 py-3">Projeto</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Domínio principal</th>
                <th className="px-5 py-3">Registros</th>
                <th className="px-5 py-3">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentProjects.map((project) => (
                <tr key={project.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                  <td className="px-5 py-4">
                    <Link href={`/projects/${project.id}`} className="font-semibold text-blue-700 hover:text-blue-800">
                      {project.name}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{project.slug}</p>
                  </td>
                  <td className="px-5 py-4">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{project.mainDomain || "—"}</td>
                  <td className="px-5 py-4 text-zinc-600">{project.recordCount ?? 0}</td>
                  <td className="px-5 py-4 text-zinc-600">{formatDateTime(project.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
