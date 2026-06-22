import type { EntityStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface StatusBadgeProps {
  status: EntityStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={status === "active" ? "success" : "muted"}>{status === "active" ? "Ativo" : "Inativo"}</Badge>;
}
