import { CloudflareApiError, deleteDnsRecord } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { CloudflareTokenError, getCloudflareToken } from "@/lib/server/cloudflare-credential";
import { isRecordDeleted } from "@/lib/server/dns-records";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord } from "@/lib/server/mappers";
import { buildDeleteConfirmationText } from "@/lib/validation";

type DeleteCloudflareRecordBody = {
  recordId?: string;
  confirmationText?: string;
  reason?: string;
};

function buildAuditRecordSnapshot(
  domainName: string,
  record: {
    type: string;
    name: string;
    content: string;
    proxied: boolean;
    cloudflareRecordId?: string | null;
    status: string;
  },
  reason?: string | null
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

export async function DELETE(request: Request) {
  let userId: string | undefined;
  let localRecordId: string | undefined;
  let domainId: string | undefined;
  let domainName: string | undefined;
  let currentRecord:
    | {
        type: string;
        name: string;
        content: string;
        proxied: boolean;
        cloudflareRecordId?: string | null;
        status: string;
      }
    | undefined;
  let reason: string | undefined;

  try {
    const user = await requireCurrentUser(request);
    userId = user.id;
    const body = await readBody<DeleteCloudflareRecordBody>(request);
    localRecordId = String(body.recordId ?? "");
    reason = body.reason?.trim() || undefined;

    if (!localRecordId) {
      return fail("Informe o registro a ser excluído.");
    }

    const existing = await prisma.dnsRecord.findUnique({
      where: { id: localRecordId },
      include: { domain: true }
    });

    if (!existing) {
      return fail("Registro DNS não encontrado.", 404);
    }

    if (isRecordDeleted(existing.status)) {
      return fail("Este registro já está marcado como excluído.");
    }

    const domain = existing.domain;
    domainId = domain.id;
    domainName = domain.name;
    currentRecord = {
      type: existing.type,
      name: existing.name,
      content: existing.content,
      proxied: existing.proxied,
      cloudflareRecordId: existing.cloudflareRecordId,
      status: existing.status
    };

    if (!existing.cloudflareRecordId) {
      return fail("Este registro não está vinculado à Cloudflare. Use a exclusão local.");
    }

    if (!domain.zoneId) {
      return fail("Para excluir registro real na Cloudflare, configure o Zone ID deste domínio.");
    }

    const expectedConfirmation = buildDeleteConfirmationText(existing.name, domain.name);
    const confirmationText = body.confirmationText?.trim() ?? "";

    if (confirmationText.trim().toLowerCase() !== expectedConfirmation) {
      return fail("Texto de confirmação inválido.");
    }

    const apiToken = await getCloudflareToken();
    await deleteDnsRecord(domain.zoneId, existing.cloudflareRecordId, apiToken);
    const deletedAt = new Date();

    const savedRecord = await prisma.$transaction(async (tx) => {
      const updated = await tx.dnsRecord.update({
        where: { id: existing.id },
        data: {
          status: "DELETED",
          deletedAt,
          deletedBy: user.id,
          deletionReason: reason ?? null
        }
      });

      await writeAudit(tx, {
        action: "DNS_RECORD_DELETE_CLOUDFLARE",
        entityType: "record",
        entityId: updated.id,
        entityName: `${updated.type} ${updated.name}`,
        userId,
        description: `Registro ${updated.type} ${updated.name} excluído da Cloudflare em ${domain.name}.`,
        oldData: buildAuditRecordSnapshot(domain.name, currentRecord!, reason),
        newData: {
          status: "DELETED",
          deletedAt: deletedAt.toISOString(),
          deletedBy: user.id,
          reason: reason ?? null
        }
      });

      return updated;
    });

    return ok({
      message: "Registro excluído da Cloudflare com sucesso.",
      record: toDnsRecord(savedRecord)
    });
  } catch (error) {
    const description =
      error instanceof CloudflareApiError
        ? `Não foi possível excluir o registro na Cloudflare. ${error.message}`
        : error instanceof Error
          ? error.message
          : "Não foi possível excluir o registro na Cloudflare.";

    if (localRecordId && currentRecord) {
      await prisma.auditLog
        .create({
          data: {
            action: "DNS_RECORD_DELETE_CLOUDFLARE_FAILED",
            entityType: "record",
            entityId: localRecordId,
            entityName: `${currentRecord.type} ${currentRecord.name}`,
            userId,
            description,
            oldData: domainName ? buildAuditRecordSnapshot(domainName, currentRecord, reason) : currentRecord,
            newData: {
              domainId,
              domainName,
              reason: reason ?? null,
              error: description
            }
          }
        })
        .catch(() => undefined);
    }

    if (error instanceof CloudflareTokenError) {
      return fail(error.message, 400);
    }

    if (error instanceof CloudflareApiError) {
      return fail("Não foi possível excluir o registro na Cloudflare.", error.status ?? 400);
    }

    return handleRouteError(error);
  }
}
