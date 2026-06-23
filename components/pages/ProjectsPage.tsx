"use client";

import { useEffect, useMemo, useState } from "react";
import { ArchiveProjectDialog } from "@/components/projects/ArchiveProjectDialog";
import { ProjectTable, type ProjectStatusFilter } from "@/components/projects/ProjectTable";
import { DomainsLoadingState } from "@/components/domains/DomainsLoadingState";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import { Plus } from "lucide-react";
import { pageContainerClass } from "@/components/layout/page-container";
import { apiRequest } from "@/lib/api-client";
import type { Project, ProjectFormInput } from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;
type ProjectsResponse = { projects: Project[] };

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [projectToArchive, setProjectToArchive] = useState<Project | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  async function reload() {
    try {
      setIsLoading(true);
      const data = await apiRequest<ProjectsResponse>("/api/projects");
      setProjects(data.projects);
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Erro ao carregar projetos."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
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

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.slug.toLowerCase().includes(normalizedSearch) ||
        (project.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (project.mainDomain ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [projects, searchTerm, statusFilter]);

  function openCreateModal() {
    setEditingProject(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(project: Project) {
    setEditingProject(project);
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setEditingProject(undefined);
  }

  async function handleSubmit(input: ProjectFormInput) {
    try {
      setIsSubmitting(true);

      if (editingProject) {
        await apiRequest<{ project: Project }>(`/api/projects/${editingProject.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Projeto atualizado com sucesso." });
      } else {
        await apiRequest<{ project: Project }>("/api/projects", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setToast({ type: "success", message: "Projeto criado com sucesso." });
      }

      setIsModalOpen(false);
      setEditingProject(undefined);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar o projeto."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmArchive() {
    if (!projectToArchive) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiRequest<{ project: Project }>(`/api/projects/${projectToArchive.id}/archive`, {
        method: "POST"
      });
      setToast({ type: "success", message: "Projeto arquivado com sucesso." });
      setProjectToArchive(undefined);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível arquivar o projeto."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={pageContainerClass}>
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">Projetos</h2>
            <FieldInfoTooltip
              label="Projetos"
              description="Agrupe registros DNS de um mesmo sistema ou aplicação para facilitar a organização."
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">
            Organize registros DNS relacionados a um mesmo sistema ou aplicação.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Plus className="h-4 w-4" />
          Novo projeto
        </button>
      </section>

      {isLoading ? (
        <DomainsLoadingState />
      ) : (
        <ProjectTable
          projects={filteredProjects}
          totalProjects={projects.length}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          isLoading={isLoading}
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onCreate={openCreateModal}
          onEdit={openEditModal}
          onArchive={setProjectToArchive}
        />
      )}

      <Modal isOpen={isModalOpen} title={editingProject ? "Editar projeto" : "Novo projeto"} onClose={closeModal}>
        <ProjectForm
          initialData={editingProject}
          isSubmitting={isSubmitting}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingProject ? "Salvar alterações" : "Criar projeto"}
        />
      </Modal>

      <ArchiveProjectDialog
        isOpen={Boolean(projectToArchive)}
        project={projectToArchive}
        isSubmitting={isSubmitting}
        onCancel={() => (isSubmitting ? undefined : setProjectToArchive(undefined))}
        onConfirm={confirmArchive}
      />
    </div>
  );
}
