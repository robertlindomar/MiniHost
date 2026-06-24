import type { ProjectStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const statusConfig: Record<ProjectStatus, { label: string; variant: "success" | "muted" | "warning" | "danger" | "info" }> = {
  DRAFT: { label: "Rascunho", variant: "muted" },
  ACTIVE: { label: "Ativo", variant: "success" },
  PAUSED: { label: "Pausado", variant: "warning" },
  ARCHIVED: { label: "Arquivado", variant: "danger" },
  TERMINATING: { label: "Encerrando", variant: "warning" },
  TERMINATED: { label: "Encerrado", variant: "muted" },
  TERMINATED_WITH_ERRORS: { label: "Encerrado com pendências", variant: "danger" }
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
