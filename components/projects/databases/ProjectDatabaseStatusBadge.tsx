import type { ProjectDatabaseStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const statusConfig: Record<
  ProjectDatabaseStatus,
  { label: string; variant: "success" | "muted" | "warning" | "danger" | "info" }
> = {
  PLANNED: { label: "Planejado", variant: "info" },
  PROVISIONING: { label: "Provisionando", variant: "warning" },
  ACTIVE: { label: "Ativo", variant: "success" },
  FAILED: { label: "Erro", variant: "danger" },
  CREATED_MANUALLY: { label: "Criado manualmente", variant: "warning" },
  DISABLED: { label: "Desabilitado", variant: "muted" },
  ARCHIVED: { label: "Arquivado", variant: "danger" }
};

export function ProjectDatabaseStatusBadge({ status }: { status: ProjectDatabaseStatus }) {
  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
