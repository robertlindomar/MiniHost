export type TerminateStepId =
  | "validate"
  | "dns"
  | "coolify_apps"
  | "coolify_project"
  | "databases"
  | "archive"
  | "sync"
  | "finished";

export type TerminateStepStatus = "pending" | "running" | "success" | "error" | "skipped" | "ignored";

export type TerminateStepResult = {
  id: TerminateStepId;
  label: string;
  status: TerminateStepStatus;
  message?: string;
};

export type TerminateOptions = {
  archiveProject: boolean;
  deleteDnsRecords: boolean;
  deleteCoolifyApplications: boolean;
  deleteCoolifyProject: boolean;
  destroyDatabases: boolean;
  confirmExternalCoolifyRemoval?: boolean;
};

export type TerminationPendingItemType = "dns" | "coolify_app" | "coolify_project" | "database";

export type TerminationPendingItem = {
  type: TerminationPendingItemType;
  id: string;
  label?: string;
  error: string;
};

export type ProjectTerminateInput = {
  projectId: string;
  confirmationText: string;
  understandRisk: boolean;
  retryPendingOnly?: boolean;
  options: TerminateOptions;
};

export type ProjectTerminateResult = {
  success: boolean;
  partial: boolean;
  message: string;
  projectId: string;
  projectStatus: string;
  steps: TerminateStepResult[];
  pending: TerminationPendingItem[];
};

export const TERMINATE_STEP_LABELS: Record<TerminateStepId, string> = {
  validate: "Validar projeto",
  dns: "Excluir DNS Cloudflare",
  coolify_apps: "Excluir aplicações no Coolify",
  coolify_project: "Excluir projeto Coolify",
  databases: "Desprovisionar bancos PostgreSQL",
  archive: "Arquivar projeto no MiniHost",
  sync: "Sincronizar Cloudflare/Coolify",
  finished: "Finalizar"
};

export function buildProjectTerminateConfirmationText(projectSlug: string) {
  return `encerrar ${projectSlug.trim().toLowerCase()}`;
}

export function isValidProjectTerminateConfirmation(projectSlug: string, confirmationText: string) {
  return confirmationText.trim().toLowerCase() === buildProjectTerminateConfirmationText(projectSlug);
}
