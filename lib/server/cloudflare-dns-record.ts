import { CloudflareApiError, createDnsRecord, listDnsRecords } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { CloudflareTokenError, getCloudflareToken } from "@/lib/server/cloudflare-credential";
import {
  findDnsRecordConflict,
  toCloudflareRecordName,
  toComparableRecordName,
  type ValidatedDnsRecordData
} from "@/lib/server/dns-records";
import { toDnsRecord } from "@/lib/server/mappers";
import type { DnsRecord } from "@/lib/types";

export class CloudflareDnsRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareDnsRecordError";
  }
}

function shouldSendProxied(type: string) {
  return type === "A" || type === "AAAA" || type === "CNAME";
}

export async function createCloudflareDnsRecord(input: {
  userId: string;
  domainId: string;
  data: ValidatedDnsRecordData;
  auditAction?: string;
  auditDescription?: string;
}) {
  const domain = await prisma.domain.findUnique({ where: { id: input.domainId } });

  if (!domain) {
    throw new CloudflareDnsRecordError("Domínio não encontrado.");
  }

  if (!domain.zoneId) {
    throw new CloudflareDnsRecordError("Para criar registro real na Cloudflare, configure o Zone ID deste domínio.");
  }

  if (input.data.projectId) {
    const project = await prisma.project.findUnique({ where: { id: input.data.projectId } });

    if (!project) {
      throw new CloudflareDnsRecordError("Projeto não encontrado.");
    }

    if (project.status === "ARCHIVED") {
      throw new CloudflareDnsRecordError("Não é possível vincular registros a um projeto arquivado.");
    }
  }

  const localRecords = await prisma.dnsRecord.findMany({
    where: { domainId: domain.id, status: { not: "DELETED" } },
    select: { id: true, type: true, name: true }
  });
  const localConflict = findDnsRecordConflict(localRecords, input.data, domain.name);

  if (localConflict) {
    throw new CloudflareDnsRecordError(localConflict);
  }

  let apiToken: string;

  try {
    apiToken = await getCloudflareToken();
  } catch (error) {
    if (error instanceof CloudflareTokenError) {
      throw new CloudflareDnsRecordError(error.message);
    }

    throw error;
  }

  const cloudflareRecords = await listDnsRecords(domain.zoneId, apiToken);
  const cloudflareConflict = findDnsRecordConflict(cloudflareRecords, input.data, domain.name);

  if (cloudflareConflict) {
    throw new CloudflareDnsRecordError(cloudflareConflict);
  }

  const cloudflareName = toCloudflareRecordName(input.data.name, domain.name);

  let cloudflareRecord;

  try {
    cloudflareRecord = await createDnsRecord(
      domain.zoneId,
      {
        type: input.data.type,
        name: cloudflareName,
        content: input.data.content,
        ttl: input.data.ttl ?? 1,
        proxied: shouldSendProxied(input.data.type) ? input.data.proxied : false,
        priority: input.data.type === "MX" && input.data.priority !== null ? input.data.priority : undefined,
        comment: input.data.comment
      },
      apiToken
    );
  } catch (error) {
    if (error instanceof CloudflareApiError) {
      throw new CloudflareDnsRecordError(
        "Não foi possível criar o registro na Cloudflare. Verifique token, Zone ID e permissões."
      );
    }

    throw error;
  }

  const syncedAt = new Date();

  const savedRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.dnsRecord.create({
      data: {
        domainId: domain.id,
        projectId: input.data.projectId,
        type: cloudflareRecord.type,
        name: toComparableRecordName(cloudflareRecord.name, domain.name),
        content: cloudflareRecord.content,
        ttl: cloudflareRecord.ttl === 1 ? null : cloudflareRecord.ttl,
        proxied: Boolean(cloudflareRecord.proxied),
        status: "active",
        comment: input.data.comment,
        priority: cloudflareRecord.priority ?? input.data.priority,
        cloudflareRecordId: cloudflareRecord.id,
        source: "cloudflare",
        lastSyncedAt: syncedAt
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await writeAudit(tx, {
      action: input.auditAction ?? "DNS_RECORD_CREATE_CLOUDFLARE",
      entityType: "record",
      entityId: created.id,
      entityName: `${created.type} ${created.name}`,
      userId: input.userId,
      description:
        input.auditDescription ??
        `Registro ${created.type} ${created.name} criado na Cloudflare para ${domain.name}.`,
      newData: {
        domain: domain.name,
        projectId: input.data.projectId,
        projectName: created.project?.name,
        type: created.type,
        name: created.name,
        content: created.content,
        cloudflareRecordId: created.cloudflareRecordId
      }
    });

    return created;
  });

  return {
    record: toDnsRecord(savedRecord) as DnsRecord,
    domainName: domain.name
  };
}
