import { listDnsRecords, CloudflareApiError, type CloudflareDnsRecord } from "@/lib/cloudflare";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord, toDomain } from "@/lib/server/mappers";

interface SyncZoneBody {
  domainId?: string;
}

function toRelativeRecordName(recordName: string, domainName: string) {
  const normalizedRecord = recordName.toLowerCase();
  const normalizedDomain = domainName.toLowerCase();

  if (normalizedRecord === normalizedDomain) {
    return "@";
  }

  if (normalizedRecord.endsWith(`.${normalizedDomain}`)) {
    return recordName.slice(0, recordName.length - domainName.length - 1);
  }

  return recordName;
}

function toRecordData(record: CloudflareDnsRecord, domainId: string, domainName: string, syncedAt: Date) {
  return {
    domainId,
    type: record.type,
    name: toRelativeRecordName(record.name, domainName),
    content: record.content,
    ttl: record.ttl === 1 ? null : record.ttl,
    proxied: Boolean(record.proxied),
    status: "active",
    comment: record.comment ?? null,
    priority: record.priority ?? null,
    cloudflareRecordId: record.id,
    source: "cloudflare",
    lastSyncedAt: syncedAt
  };
}

export async function POST(request: Request) {
  let user: SessionUser | undefined;
  let domainId: string | undefined;
  let userId: string | undefined;

  try {
    user = await requireCurrentUser(request);
    userId = user.id;
    const body = await readBody<SyncZoneBody>(request);
    domainId = body.domainId;

    if (!domainId) {
      return fail("Domínio não informado.");
    }

    const domain = await prisma.domain.findUnique({
      where: { id: domainId }
    });

    if (!domain) {
      return fail("Domínio não encontrado.", 404);
    }

    if (!domain.zoneId) {
      return fail("Para sincronizar com Cloudflare, configure o Zone ID deste domínio.");
    }

    await writeAudit(prisma, {
      action: "CLOUDFLARE_SYNC",
      entityType: "domain",
      entityId: domain.id,
      entityName: domain.name,
      userId,
      description: `Sincronização com Cloudflare iniciada para ${domain.name}.`,
      newData: toDomain(domain)
    });

    const cloudflareRecords = await listDnsRecords(domain.zoneId);
    const syncedAt = new Date();
    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const cloudflareRecord of cloudflareRecords) {
        const data = toRecordData(cloudflareRecord, domain.id, domain.name, syncedAt);
        const existingByCloudflareId = await tx.dnsRecord.findUnique({
          where: { cloudflareRecordId: cloudflareRecord.id }
        });
        const existing =
          existingByCloudflareId ??
          (await tx.dnsRecord.findFirst({
            where: {
              domainId: domain.id,
              type: data.type,
              name: data.name
            }
          }));

        if (existing) {
          await tx.dnsRecord.update({
            where: { id: existing.id },
            data
          });
          updated += 1;
        } else {
          await tx.dnsRecord.create({
            data
          });
          created += 1;
        }
      }

      await writeAudit(tx, {
        action: "CLOUDFLARE_SYNC",
        entityType: "domain",
        entityId: domain.id,
        entityName: domain.name,
        userId,
        description: `Sincronização concluída: ${created} registros importados e ${updated} registros atualizados.`,
        newData: {
          imported: created,
          updated,
          total: cloudflareRecords.length
        }
      });
    });

    const records = await prisma.dnsRecord.findMany({
      where: { domainId: domain.id },
      orderBy: { updatedAt: "desc" }
    });

    return ok({
      imported: created,
      updated,
      total: cloudflareRecords.length,
      records: records.map(toDnsRecord)
    });
  } catch (error) {
    const description =
      error instanceof CloudflareApiError
        ? error.message
        : "Não foi possível sincronizar com a Cloudflare. Verifique o token e o Zone ID.";

    if (domainId) {
      await prisma.auditLog
        .create({
          data: {
            action: "CLOUDFLARE_SYNC",
            entityType: "domain",
            entityId: domainId,
            userId: user?.id,
            description: `Erro na sincronização: ${description}`
          }
        })
        .catch(() => undefined);
    }

    if (error instanceof CloudflareApiError) {
      return fail(error.message, error.status ?? 400);
    }

    return handleRouteError(error);
  }
}
