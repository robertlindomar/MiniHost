import { Badge } from "@/components/ui/Badge";
import type { ProjectApplicationStatus, ProjectApplicationType } from "@/lib/types";

const statusConfig: Record<ProjectApplicationStatus, { label: string; variant: "success" | "muted" | "warning" | "danger" | "info" }> = {
  DRAFT: { label: "Rascunho", variant: "muted" },
  READY: { label: "Pronta", variant: "success" },
  LINKED: { label: "Vinculada", variant: "info" },
  ENVS_APPLIED: { label: "Envs aplicadas", variant: "info" },
  DEPLOYING: { label: "Em deploy", variant: "warning" },
  DEPLOYED: { label: "Deploy feito", variant: "success" },
  FAILED: { label: "Falha", variant: "danger" },
  ARCHIVED: { label: "Arquivada", variant: "warning" },
  REMOVED_REMOTE: { label: "Removida no Coolify", variant: "danger" }
};

const typeLabels: Record<ProjectApplicationType, string> = {
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  FULLSTACK: "Fullstack",
  STATIC: "Static",
  DOCKERFILE: "Dockerfile",
  DOCKER_COMPOSE: "Docker Compose",
  OTHER: "Outro"
};

export function ApplicationStatusBadge({ status }: { status: ProjectApplicationStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ApplicationTypeBadge({ type }: { type: ProjectApplicationType }) {
  return <Badge variant="info">{typeLabels[type]}</Badge>;
}

export function getApplicationTypeLabel(type: ProjectApplicationType) {
  return typeLabels[type];
}
