import { CloudflareApiError, createDnsRecord, listDnsRecords } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { findDnsRecordConflict, toCloudflareRecordName, toComparableRecordName } from "@/lib/server/dns-records";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord } from "@/lib/server/mappers";
import { validateDnsRecordBody } from "@/lib/server/validation";
import type { DnsRecordFormInput, DnsRecordType } from "@/lib/types";

type CreateCloudflareRecordBody = Partial<DnsRecordFormInput> & {
  content?: string;
};

function normalizeRecordInput(body: CreateCloudflareRecordBody): DnsRecordFormInput {
  return {
    domainId: String(body.domainId ?? ""),
    type: (body.type ?? "A") as DnsRecordType,
    name: String(body.name ?? ""),
    value: String(body.value ?? body.content ?? ""),
    ttl: body.ttl === "auto" ? "auto" : Number(body.ttl ?? 1),
    proxied: Boolean(body.proxied),
    status: body.status === "inactive" ? "inactive" : "active",
    comment: body.comment ? String(body.comment) : "",
    priority: body.priority === undefined || body.priority === null ? undefined : Number(body.priority),
    templateName: body.templateName ? String(body.templateName) : undefined
  };
}

function shouldSendProxied(type: string) {
  return type === "A" || type === "AAAA" || type === "CNAME";
}

export async function POST(request: Request) {
  let userId: string | undefined;
  let domainId: string | undefined;
  let domainName: string | undefined;
  let requestedRecord: DnsRecordFormInput | undefined;

  try {
    const user = await requireCurrentUser(request);
    userId = user.id;
    const body = normalizeRecordInput(await readBody<CreateCloudflareRecordBody>(request));
    requestedRecord = body;
    domainId = body.domainId;

    const { data, errors } = validateDnsRecordBody(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const domain = await prisma.domain.findUnique({ where: { id: data.domainId } });

    if (!domain) {
      return fail("Domínio não encontrado.", 404);
    }

    domainName = domain.name;

    if (!domain.zoneId) {
      return fail("Para criar registro real na Cloudflare, configure o Zone ID deste domínio.");
    }

    const localRecords = await prisma.dnsRecord.findMany({
      where: { domainId: domain.id, status: { not: "DELETED" } },
      select: {
        id: true,
        type: true,
        name: true
      }
    });
    const localConflict = findDnsRecordConflict(localRecords, data, domain.name);

    if (localConflict) {
      return fail(localConflict);
    }

    const cloudflareRecords = await listDnsRecords(domain.zoneId);
    const cloudflareConflict = findDnsRecordConflict(cloudflareRecords, data, domain.name);

    if (cloudflareConflict) {
      return fail(cloudflareConflict);
    }

    const cloudflareName = toCloudflareRecordName(data.name, domain.name);
    const cloudflareRecord = await createDnsRecord(domain.zoneId, {
      type: data.type,
      name: cloudflareName,
      content: data.content,
      ttl: data.ttl ?? 1,
      proxied: shouldSendProxied(data.type) ? data.proxied : false,
      priority: data.type === "MX" && data.priority !== null ? data.priority : undefined,
      comment: data.comment
    });
    const syncedAt = new Date();

    const savedRecord = await prisma.$transaction(async (tx) => {
      const created = await tx.dnsRecord.create({
        data: {
          domainId: domain.id,
          type: cloudflareRecord.type,
          name: toComparableRecordName(cloudflareRecord.name, domain.name),
          content: cloudflareRecord.content,
          ttl: cloudflareRecord.ttl === 1 ? null : cloudflareRecord.ttl,
          proxied: Boolean(cloudflareRecord.proxied),
          status: "active",
          comment: data.comment,
          priority: cloudflareRecord.priority ?? data.priority,
          cloudflareRecordId: cloudflareRecord.id,
          source: "cloudflare",
          lastSyncedAt: syncedAt
        }
      });

      await writeAudit(tx, {
        action: body.templateName ? "DNS_RECORD_CREATE_FROM_TEMPLATE_CLOUDFLARE" : "DNS_RECORD_CREATE_CLOUDFLARE",
        entityType: "record",
        entityId: created.id,
        entityName: `${created.type} ${created.name}`,
        userId,
        description: body.templateName
          ? `Registro ${created.type} ${created.name} criado na Cloudflare para ${domain.name} pelo template ${body.templateName}.`
          : `Registro ${created.type} ${created.name} criado na Cloudflare para ${domain.name}.`,
        newData: {
          domain: domain.name,
          templateName: body.templateName,
          type: created.type,
          name: created.name,
          content: created.content,
          cloudflareRecordId: created.cloudflareRecordId
        }
      });

      return created;
    });

    return ok(
      {
        message: "Registro criado na Cloudflare com sucesso.",
        record: toDnsRecord(savedRecord)
      },
      { status: 201 }
    );
  } catch (error) {
    const description =
      error instanceof CloudflareApiError
        ? `Não foi possível criar o registro na Cloudflare. ${error.message}`
        : error instanceof Error
          ? error.message
          : "Não foi possível criar o registro na Cloudflare.";

    if (domainId) {
      await prisma.auditLog
        .create({
          data: {
            action: "DNS_RECORD_CREATE_CLOUDFLARE_FAILED",
            entityType: "record",
            entityId: null,
            entityName: requestedRecord ? `${requestedRecord.type} ${requestedRecord.name || "@"}` : null,
            userId,
            description,
            newData: {
              domainId,
              domainName,
              templateName: requestedRecord?.templateName,
              type: requestedRecord?.type,
              name: requestedRecord?.name,
              content: requestedRecord?.value
            }
          }
        })
        .catch(() => undefined);
    }

    if (error instanceof CloudflareApiError) {
      return fail("Não foi possível criar o registro na Cloudflare. Verifique token, Zone ID e permissões.", error.status ?? 400);
    }

    return handleRouteError(error);
  }
}
