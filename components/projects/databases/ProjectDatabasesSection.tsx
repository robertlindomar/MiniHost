"use client";

import { Database, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ArchiveProjectDatabaseDialog } from "@/components/projects/databases/ArchiveProjectDatabaseDialog";
import { ProjectDatabaseDetailModal } from "@/components/projects/databases/ProjectDatabaseDetailModal";
import { ProjectDatabaseForm } from "@/components/projects/databases/ProjectDatabaseForm";
import { ProjectDatabaseTable } from "@/components/projects/databases/ProjectDatabaseTable";
import { FixPermissionsModal } from "@/components/projects/databases/FixPermissionsModal";
import { ProvisionDatabaseModal } from "@/components/projects/databases/ProvisionDatabaseModal";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import type {
  PostgresAdminStatus,
  Project,
  ProjectDatabase,
  ProjectDatabaseFormInput,
  ProjectDatabasePermissionVerification,
  ProjectDatabaseSuggestions
} from "@/lib/types";

interface ProjectDatabasesSectionProps {
  project: Project;
  onChanged?: () => void;
}

type DatabasesResponse = { databases: ProjectDatabase[] };
type SuggestionsResponse = { suggestions: ProjectDatabaseSuggestions };
type CreateDatabaseResponse = { database: ProjectDatabase; generatedPassword?: string };
type GenerateContentResponse = { envContent?: string; sqlContent?: string; warning: string };
type RotatePasswordResponse = { database: ProjectDatabase; generatedPassword: string };
type ProvisionResponse = { message: string; database: ProjectDatabase };
type PermissionResponse = { message: string; verification: ProjectDatabasePermissionVerification };
type SettingsStatusResponse = { postgresAdmin?: PostgresAdminStatus };

export function ProjectDatabasesSection({ project, onChanged }: ProjectDatabasesSectionProps) {
  const [databases, setDatabases] = useState<ProjectDatabase[]>([]);
  const [suggestions, setSuggestions] = useState<ProjectDatabaseSuggestions | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<ProjectDatabase | undefined>();
  const [databaseToArchive, setDatabaseToArchive] = useState<ProjectDatabase | undefined>();
  const [selectedDatabase, setSelectedDatabase] = useState<ProjectDatabase | undefined>();
  const [generatedPassword, setGeneratedPassword] = useState<string | undefined>();
  const [envContent, setEnvContent] = useState<string | undefined>();
  const [sqlContent, setSqlContent] = useState<string | undefined>();
  const [contentWarning, setContentWarning] = useState<string | undefined>();
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<"env" | "sql" | null>(null);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [isFixPermissionsModalOpen, setIsFixPermissionsModalOpen] = useState(false);
  const [permissionVerification, setPermissionVerification] = useState<ProjectDatabasePermissionVerification | undefined>();
  const [hasAdminCredential, setHasAdminCredential] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isArchivedProject = project.status === "ARCHIVED";

  async function reload() {
    try {
      setIsLoading(true);
      const data = await apiRequest<DatabasesResponse>(`/api/projects/${project.id}/databases`);
      setDatabases(data.databases);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSuggestions() {
    const data = await apiRequest<SuggestionsResponse>(`/api/projects/${project.id}/databases/suggestions`);
    setSuggestions(data.suggestions);
  }

  async function loadAdminStatus() {
    try {
      const data = await apiRequest<SettingsStatusResponse>("/api/settings");
      setHasAdminCredential(Boolean(data.postgresAdmin?.hasCredential));
    } catch {
      setHasAdminCredential(false);
    }
  }

  useEffect(() => {
    void reload();
    void loadAdminStatus();
  }, [project.id]);

  function openCreateModal() {
    setEditingDatabase(undefined);
    setGeneratedPassword(undefined);
    void loadSuggestions();
    setIsFormOpen(true);
  }

  function openEditModal(database: ProjectDatabase) {
    setEditingDatabase(database);
    setIsFormOpen(true);
  }

  function closeFormModal() {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setEditingDatabase(undefined);
  }

  async function handleSubmit(input: ProjectDatabaseFormInput) {
    try {
      setIsSubmitting(true);

      if (editingDatabase) {
        await apiRequest(`/api/projects/${project.id}/databases/${editingDatabase.id}`, {
          method: "PATCH",
          body: JSON.stringify(input)
        });
        setIsFormOpen(false);
        setEditingDatabase(undefined);
      } else {
        const data = await apiRequest<CreateDatabaseResponse>(`/api/projects/${project.id}/databases`, {
          method: "POST",
          body: JSON.stringify(input)
        });
        setIsFormOpen(false);
        setSelectedDatabase(data.database);
        setGeneratedPassword(data.generatedPassword);
        setEnvContent(undefined);
        setSqlContent(undefined);
        setContentWarning(undefined);
      }

      await reload();
      onChanged?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmArchive() {
    if (!databaseToArchive) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiRequest(`/api/projects/${project.id}/databases/${databaseToArchive.id}/archive`, {
        method: "POST"
      });
      setDatabaseToArchive(undefined);
      if (selectedDatabase?.id === databaseToArchive.id) {
        setSelectedDatabase(undefined);
      }
      await reload();
      onChanged?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runSensitiveAction(action: "env" | "sql", database: ProjectDatabase) {
    try {
      setIsSubmitting(true);
      const endpoint =
        action === "env"
          ? `/api/projects/${project.id}/databases/${database.id}/generate-env`
          : `/api/projects/${project.id}/databases/${database.id}/generate-sql`;

      const data = await apiRequest<GenerateContentResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify({ confirmSensitive: true })
      });

      setSelectedDatabase(database);
      setContentWarning(data.warning);
      if (action === "env") {
        setEnvContent(data.envContent);
        setSqlContent(undefined);
      } else {
        setSqlContent(data.sqlContent);
        setEnvContent(undefined);
      }
    } finally {
      setIsSubmitting(false);
      setPendingSensitiveAction(null);
    }
  }

  async function handleRotatePassword(database: ProjectDatabase) {
    try {
      setIsSubmitting(true);
      const data = await apiRequest<RotatePasswordResponse>(
        `/api/projects/${project.id}/databases/${database.id}/rotate-password`,
        { method: "POST" }
      );
      setSelectedDatabase(data.database);
      setGeneratedPassword(data.generatedPassword);
      setEnvContent(undefined);
      setSqlContent(undefined);
      setContentWarning("Nova senha gerada. Copie agora — ela não será exibida novamente.");
      await reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDetail(database: ProjectDatabase) {
    setSelectedDatabase(database);
    setGeneratedPassword(undefined);
    setEnvContent(undefined);
    setSqlContent(undefined);
    setContentWarning(undefined);
    setPermissionVerification(undefined);
  }

  function closeDetail() {
    setSelectedDatabase(undefined);
    setGeneratedPassword(undefined);
    setEnvContent(undefined);
    setSqlContent(undefined);
    setContentWarning(undefined);
    setPermissionVerification(undefined);
    setIsProvisionModalOpen(false);
    setIsFixPermissionsModalOpen(false);
  }

  async function handleProvision(confirmationText: string) {
    if (!selectedDatabase) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<ProvisionResponse>("/api/projects/databases/provision", {
        method: "POST",
        body: JSON.stringify({
          projectDatabaseId: selectedDatabase.id,
          confirmationText
        })
      });

      setSelectedDatabase(data.database);
      setIsProvisionModalOpen(false);
      setToast({ type: "success", message: data.message });
      await reload();
      onChanged?.();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível provisionar o banco."
      });
      await reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyPermissions() {
    if (!selectedDatabase) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<PermissionResponse>(
        `/api/projects/${project.id}/databases/${selectedDatabase.id}/verify-permissions`,
        { method: "POST" }
      );
      setPermissionVerification(data.verification);
      setToast({ type: data.verification.ok ? "success" : "error", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível verificar permissões."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFixPermissions(confirmationText: string) {
    if (!selectedDatabase) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiRequest<PermissionResponse>(
        `/api/projects/${project.id}/databases/${selectedDatabase.id}/fix-permissions`,
        {
          method: "POST",
          body: JSON.stringify({ confirmationText })
        }
      );
      setPermissionVerification(data.verification);
      setIsFixPermissionsModalOpen(false);
      setToast({ type: data.verification.ok ? "success" : "error", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível corrigir permissões."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Bancos PostgreSQL</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Planeje bancos por projeto, gere credenciais e exporte .env ou SQL manual.
            </p>
          </div>
        </div>
        {!isArchivedProject ? (
          <button
            type="button"
            onClick={openCreateModal}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            Novo banco PostgreSQL
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-16 rounded-md bg-zinc-100" />
          ))}
        </div>
      ) : (
        <ProjectDatabaseTable
          databases={databases}
          isArchivedProject={isArchivedProject}
          isSubmitting={isSubmitting}
          onCreate={openCreateModal}
          onView={openDetail}
          onEdit={openEditModal}
          onArchive={setDatabaseToArchive}
          onGenerateEnv={(database) => {
            setPendingSensitiveAction("env");
            setSelectedDatabase(database);
          }}
        />
      )}

      <Modal
        isOpen={isFormOpen}
        title={editingDatabase ? "Editar banco PostgreSQL" : "Novo banco PostgreSQL"}
        onClose={closeFormModal}
      >
        <ProjectDatabaseForm
          initialData={editingDatabase}
          suggestions={suggestions}
          isSubmitting={isSubmitting}
          onCancel={closeFormModal}
          onSubmit={handleSubmit}
          submitLabel={editingDatabase ? "Salvar alterações" : "Criar banco planejado"}
        />
      </Modal>

      <ProjectDatabaseDetailModal
        database={selectedDatabase}
        isOpen={Boolean(selectedDatabase) && !pendingSensitiveAction && !isProvisionModalOpen && !isFixPermissionsModalOpen}
        isSubmitting={isSubmitting}
        hasAdminCredential={hasAdminCredential}
        permissionVerification={permissionVerification}
        envContent={envContent}
        sqlContent={sqlContent}
        generatedPassword={generatedPassword}
        warning={contentWarning}
        onClose={closeDetail}
        onGenerateEnv={() => setPendingSensitiveAction("env")}
        onGenerateSql={() => setPendingSensitiveAction("sql")}
        onRotatePassword={() => selectedDatabase && void handleRotatePassword(selectedDatabase)}
        onProvision={() => setIsProvisionModalOpen(true)}
        onVerifyPermissions={() => void handleVerifyPermissions()}
        onFixPermissions={() => setIsFixPermissionsModalOpen(true)}
      />

      <ProvisionDatabaseModal
        database={selectedDatabase}
        project={project}
        isOpen={isProvisionModalOpen && Boolean(selectedDatabase)}
        isSubmitting={isSubmitting}
        onClose={() => setIsProvisionModalOpen(false)}
        onConfirm={(confirmationText) => void handleProvision(confirmationText)}
      />

      <FixPermissionsModal
        database={selectedDatabase}
        isOpen={isFixPermissionsModalOpen && Boolean(selectedDatabase)}
        isSubmitting={isSubmitting}
        onClose={() => setIsFixPermissionsModalOpen(false)}
        onConfirm={(confirmationText) => void handleFixPermissions(confirmationText)}
      />

      <ConfirmDialog
        isOpen={pendingSensitiveAction !== null && Boolean(selectedDatabase)}
        title={pendingSensitiveAction === "env" ? "Gerar .env com credenciais" : "Gerar SQL com credenciais"}
        message={
          pendingSensitiveAction === "env"
            ? "Este .env conterá credenciais sensíveis. Não compartilhe publicamente. Deseja continuar?"
            : "O SQL gerado incluirá a senha em texto. Revise antes de executar em produção. Deseja continuar?"
        }
        confirmLabel="Gerar agora"
        confirmingLabel="Gerando..."
        isConfirming={isSubmitting}
        onCancel={() => setPendingSensitiveAction(null)}
        onConfirm={() => selectedDatabase && pendingSensitiveAction && void runSensitiveAction(pendingSensitiveAction, selectedDatabase)}
      />

      <ArchiveProjectDatabaseDialog
        isOpen={Boolean(databaseToArchive)}
        database={databaseToArchive}
        isSubmitting={isSubmitting}
        onCancel={() => (isSubmitting ? undefined : setDatabaseToArchive(undefined))}
        onConfirm={() => void confirmArchive()}
      />

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </section>
  );
}
