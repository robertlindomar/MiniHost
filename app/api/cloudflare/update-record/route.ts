import { CloudflareApiError, listDnsRecords, updateDnsRecord } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { findDnsRecordConflict, isRecordDeleted, toCloudflareRecordName, toComparableRecordName } from "@/lib/server/dns-records";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord } from "@/lib/server/mappers";
import { validateDnsRecordBody } from "@/lib/server/validation";
import type { DnsRecordFormInput, DnsRecordType, EntityStatus } from "@/lib/types";

type UpdateCloudflareRecordBody = {
  recordId?: string;
  name?: string;
  content?: string;
  value?: string;
  ttl?: number | "auto";
  proxied?: boolean;
  status?: EntityStatus;
  comment?: string;
  type?: string;
  priority?: number;
  domainId?: string;
};

function shouldSendProxied(type: string) {
  return type === "A" || type === "AAAA" || type === "CNAME";
}

function buildAuditSnapshot(
  domainName: string,
  record: {
    type: string;
    name: string;
    content: string;
    proxied: boolean;
  }
) {
  return {
    domain: domainName,
    type: record.type,
    name: record.name,
    content: record.content,
    proxied: record.proxied
  };
}

export async function PATCH(request: Request) {
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
      }
    | undefined;

  try {
    const user = await requireCurrentUser(request);
    userId = user.id;
    const body = await readBody<UpdateCloudflareRecordBody>(request);
    localRecordId = String(body.recordId ?? "");

    if (!localRecordId) {
      return fail("Informe o registro a ser atualizado.");
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

    if (!existing.cloudflareRecordId) {
      return fail("Este registro não está vinculado à Cloudflare. Use a edição local.");
    }

    const domain = existing.domain;
    domainId = domain.id;
    domainName = domain.name;
    currentRecord = {
      type: existing.type,
      name: existing.name,
      content: existing.content,
      proxied: existing.proxied
    };

    if (!domain.zoneId) {
      return fail("Para atualizar registro real na Cloudflare, configure o Zone ID deste domínio.");
    }

    if (body.type && body.type !== existing.type) {
      return fail("Não é permitido alterar o tipo do registro. Crie um novo registro se precisar trocar o tipo.");
    }

    const normalizedInput: DnsRecordFormInput = {
      domainId: domain.id,
      type: existing.type as DnsRecordType,
      name: String(body.name ?? existing.name),
      value: String(body.value ?? body.content ?? existing.content),
      ttl: body.ttl === "auto" || body.ttl === undefined || body.ttl === 1 ? "auto" : Number(body.ttl),
      proxied: body.proxied === undefined ? existing.proxied : Boolean(body.proxied),
      status: body.status === "inactive" ? "inactive" : body.status === "active" ? "active" : existing.status === "inactive" ? "inactive" : "active",
      comment: body.comment !== undefined ? String(body.comment) : existing.comment ?? "",
      priority:
        existing.type === "MX"
          ? body.priority === undefined || body.priority === null
            ? (existing.priority ?? undefined)
            : Number(body.priority)
          : undefined
    };

    const { data, errors } = validateDnsRecordBody(normalizedInput);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const localRecords = await prisma.dnsRecord.findMany({
      where: { domainId: domain.id, status: { not: "DELETED" } },
      select: {
        id: true,
        type: true,
        name: true
      }
    });
    const localConflict = findDnsRecordConflict(localRecords, data, domain.name, existing.id);

    if (localConflict) {
      return fail(localConflict);
    }

    const cloudflareRecords = await listDnsRecords(domain.zoneId);
    const cloudflareConflict = findDnsRecordConflict(cloudflareRecords, data, domain.name, existing.cloudflareRecordId);

    if (cloudflareConflict) {
      return fail(cloudflareConflict);
    }

    const cloudflareName = toCloudflareRecordName(data.name, domain.name);
    const cloudflareRecord = await updateDnsRecord(domain.zoneId, existing.cloudflareRecordId, {
      name: cloudflareName,
      content: data.content,
      ttl: data.ttl ?? 1,
      proxied: shouldSendProxied(data.type) ? data.proxied : false,
      priority: data.type === "MX" && data.priority !== null ? data.priority : undefined,
      comment: data.comment
    });
    const syncedAt = new Date();

    const savedRecord = await prisma.$transaction(async (tx) => {
      const updated = await tx.dnsRecord.update({
        where: { id: existing.id },
        data: {
          type: cloudflareRecord.type,
          name: toComparableRecordName(cloudflareRecord.name, domain.name),
          content: cloudflareRecord.content,
          ttl: cloudflareRecord.ttl === 1 ? null : cloudflareRecord.ttl,
          proxied: Boolean(cloudflareRecord.proxied),
          status: data.status,
          comment: data.comment,
          priority: cloudflareRecord.priority ?? data.priority,
          source: "cloudflare",
          lastSyncedAt: syncedAt
        }
      });

      await writeAudit(tx, {
        action: "DNS_RECORD_UPDATE_CLOUDFLARE",
        entityType: "record",
        entityId: updated.id,
        entityName: `${updated.type} ${updated.name}`,
        userId,
        description: `Registro ${updated.type} ${updated.name} atualizado na Cloudflare para ${domain.name}.`,
        oldData: buildAuditSnapshot(domain.name, currentRecord!),
        newData: buildAuditSnapshot(domain.name, {
          type: updated.type,
          name: updated.name,
          content: updated.content,
          proxied: updated.proxied
        })
      });

      return updated;
    });

    return ok({
      message: "Registro atualizado na Cloudflare com sucesso.",
      record: toDnsRecord(savedRecord)
    });
  } catch (error) {
    const description =
      error instanceof CloudflareApiError
        ? `Não foi possível atualizar o registro na Cloudflare. ${error.message}`
        : error instanceof Error
          ? error.message
          : "Não foi possível atualizar o registro na Cloudflare.";

    if (localRecordId && currentRecord) {
      await prisma.auditLog
        .create({
          data: {
            action: "DNS_RECORD_UPDATE_CLOUDFLARE_FAILED",
            entityType: "record",
            entityId: localRecordId,
            entityName: `${currentRecord.type} ${currentRecord.name}`,
            userId,
            description,
            oldData: domainName ? buildAuditSnapshot(domainName, currentRecord) : currentRecord,
            newData: {
              domainId,
              domainName,
              error: description
            }
          }
        })
        .catch(() => undefined);
    }

    if (error instanceof CloudflareApiError) {
      return fail("Não foi possível atualizar o registro na Cloudflare.", error.status ?? 400);
    }

    return handleRouteError(error);
  }
}
