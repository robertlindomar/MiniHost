"use client";

import { Archive, Eye, FileCode2, MoreVertical, Pencil } from "lucide-react";
import { useState } from "react";
import { ProjectDatabaseStatusBadge } from "@/components/projects/databases/ProjectDatabaseStatusBadge";
import { DomainEmptyState } from "@/components/domains/DomainEmptyState";
import { formatDateTime } from "@/lib/format";
import { MASKED_SECRET_VALUE } from "@/lib/settings";
import type { ProjectDatabase } from "@/lib/types";

interface ProjectDatabaseTableProps {
  databases: ProjectDatabase[];
  isArchivedProject?: boolean;
  isSubmitting?: boolean;
  onCreate: () => void;
  onView: (database: ProjectDatabase) => void;
  onEdit: (database: ProjectDatabase) => void;
  onArchive: (database: ProjectDatabase) => void;
  onGenerateEnv: (database: ProjectDatabase) => void;
}

export function ProjectDatabaseTable({
  databases,
  isArchivedProject = false,
  isSubmitting = false,
  onCreate,
  onView,
  onEdit,
  onArchive,
  onGenerateEnv
}: ProjectDatabaseTableProps) {
  if (databases.length === 0) {
    return (
      <DomainEmptyState
        title="Nenhum banco PostgreSQL cadastrado"
        description="Planeje bancos por projeto, gere credenciais seguras e exporte .env ou SQL manual."
        actionLabel={isArchivedProject ? undefined : "Novo banco PostgreSQL"}
        onAction={isArchivedProject ? undefined : onCreate}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full border-collapse">
        <thead className="bg-zinc-50">
          <tr className="text-left text-xs font-semibold text-zinc-500">
            <th className="px-4 py-3">Nome interno</th>
            <th className="px-4 py-3">Database</th>
            <th className="px-4 py-3">Usuário</th>
            <th className="px-4 py-3">Host</th>
            <th className="px-4 py-3">Porta</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Criado em</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {databases.map((database) => (
            <tr key={database.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
              <td className="px-4 py-4">
                <div className="font-semibold text-zinc-950">{database.name}</div>
                <p className="mt-1 font-mono text-xs text-zinc-500">Senha: {MASKED_SECRET_VALUE}</p>
              </td>
              <td className="px-4 py-4 font-mono text-xs">{database.databaseName}</td>
              <td className="px-4 py-4 font-mono text-xs">{database.databaseUser}</td>
              <td className="px-4 py-4">{database.host}</td>
              <td className="px-4 py-4">{database.port}</td>
              <td className="px-4 py-4">
                <ProjectDatabaseStatusBadge status={database.status} />
              </td>
              <td className="px-4 py-4 text-zinc-600">{formatDateTime(database.createdAt)}</td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onView(database)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver detalhes
                  </button>
                  {database.status !== "ARCHIVED" && !isArchivedProject ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onGenerateEnv(database)}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <FileCode2 className="h-3.5 w-3.5" />
                        Gerar .env
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(database)}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(database)}
                        className="inline-flex items-center justify-center rounded-md border border-amber-100 bg-amber-50 px-2.5 py-2 text-amber-700 transition hover:bg-amber-100"
                        aria-label={`Arquivar ${database.name}`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md px-2 py-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label={`Mais ações para ${database.name}`}
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
  );
}
