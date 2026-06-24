import { CloudflareApiError, deleteDnsRecord } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { CloudflareTokenError, getCloudflareToken } from "@/lib/server/cloudflare-credential";
import { isRecordDeleted } from "@/lib/server/dns-records";

export type DnsRecordDeleteOutcome = "success" | "failed" | "skipped";

export type DnsRecordDeleteResult = {
  outcome: DnsRecordDeleteOutcome;
  message: string;
  recordId: string;
  recordName?: string;
};

function buildAuditSnapshot(
  domainName: string,
  record: {
    type: string;
    name: string;
    content: string;
    proxied: boolean;
    cloudflareRecordId?: string | null;
    status: string;
  },
  reason?: string
) {
  return {
    domain: domainName,
    type: record.type,
    name: record.name,
    content: record.content,
    proxied: record.proxied,
    cloudflareRecordId: record.cloudflareRecordId,
    status: record.status,
    reason: reason ?? null
  };
}

export async function deleteProjectDnsRecord(input: {
  recordId: string;
  userId: string;
  reason?: string;
  auditSuccessAction?: string;
  auditFailedAction?: string;
}): Promise<DnsRecordDeleteResult> {
  const reason = input.reason?.trim() || "Encerramento de projeto";
  const existing = await prisma.dnsRecord.findUnique({
    where: { id: input.recordId },
    include: { domain: true }
  });

  if (!existing) {
    return {
      outcome: "failed",
      message: "Registro DNS não encontrado.",
      recordId: input.recordId
    };
  }

  if (isRecordDeleted(existing.status)) {
    return {
      outcome: "skipped",
      message: "Registro já estava marcado como excluído.",
      recordId: existing.id,
      recordName: existing.name
    };
  }

  const domain = existing.domain;
  const snapshot = buildAuditSnapshot(domain.name, existing, reason);

  try {
    if (existing.cloudflareRecordId && existing.status === "active") {
      if (!domain.zoneId) {
        throw new Error("Zone ID do domínio não configurado para exclusão na Cloudflare.");
      }

      const apiToken = await getCloudflareToken();
      await deleteDnsRecord(domain.zoneId, existing.cloudflareRecordId, apiToken);
    }

    const deletedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.dnsRecord.update({
        where: { id: existing.id },
        data: {
          status: "DELETED",
          deletedAt,
          deletedBy: input.userId,
          deletionReason: reason
        }
      });

      await writeAudit(tx, {
        action: input.auditSuccessAction ?? "DNS_RECORD_DELETE_CLOUDFLARE",
        entityType: "record",
        entityId: existing.id,
        entityName: `${existing.type} ${existing.name}`,
        userId: input.userId,
        description: `Registro ${existing.type} ${existing.name} excluído durante encerramento de projeto.`,
        oldData: snapshot,
        newData: {
          status: "DELETED",
          deletedAt: deletedAt.toISOString(),
          deletedBy: input.userId,
          reason
        }
      });
    });

    return {
      outcome: "success",
      message: existing.cloudflareRecordId
        ? "Registro excluído na Cloudflare e marcado como removido localmente."
        : "Registro marcado como excluído localmente.",
      recordId: existing.id,
      recordName: existing.name
    };
  } catch (error) {
    const description =
      error instanceof CloudflareApiError
        ? `Não foi possível excluir o registro na Cloudflare. ${error.message}`
        : error instanceof CloudflareTokenError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Não foi possível excluir o registro DNS.";

    await prisma.auditLog
      .create({
        data: {
          action: input.auditFailedAction ?? "DNS_RECORD_DELETE_CLOUDFLARE_FAILED",
          entityType: "record",
          entityId: existing.id,
          entityName: `${existing.type} ${existing.name}`,
          userId: input.userId,
          description,
          oldData: snapshot,
          newData: {
            domainId: domain.id,
            domainName: domain.name,
            reason,
            error: description
          }
        }
      })
      .catch(() => undefined);

    return {
      outcome: "failed",
      message: description,
      recordId: existing.id,
      recordName: existing.name
    };
  }
}
