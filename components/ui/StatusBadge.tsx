import type { DnsRecordStatus, EntityStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface StatusBadgeProps {
  status: DnsRecordStatus | EntityStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "DELETED") {
    return <Badge variant="danger">Excluído</Badge>;
  }

  return <Badge variant={status === "active" ? "success" : "muted"}>{status === "active" ? "Ativo" : "Inativo"}</Badge>;
}
