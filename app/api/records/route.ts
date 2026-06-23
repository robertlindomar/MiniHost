import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { validateLocalDnsRecordUniqueness } from "@/lib/server/dns-records";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord } from "@/lib/server/mappers";
import { validateDnsRecordBody } from "@/lib/server/validation";
import type { DnsRecordFormInput, DnsRecordType } from "@/lib/types";

function normalizeRecordInput(body: Partial<DnsRecordFormInput>): DnsRecordFormInput {
  return {
    domainId: String(body.domainId ?? ""),
    type: (body.type ?? "A") as DnsRecordType,
    name: String(body.name ?? ""),
    value: String(body.value ?? ""),
    ttl: body.ttl === "auto" ? "auto" : Number(body.ttl ?? 0),
    proxied: Boolean(body.proxied),
    status: body.status === "inactive" ? "inactive" : "active",
    comment: body.comment ? String(body.comment) : "",
    priority: body.priority === undefined || body.priority === null ? undefined : Number(body.priority)
  };
}

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId");
    const visibility = url.searchParams.get("visibility") ?? "active";

    const statusFilter =
      visibility === "deleted"
        ? { status: "DELETED" as const }
        : visibility === "all"
          ? {}
          : { status: { not: "DELETED" as const } };

    const records = await prisma.dnsRecord.findMany({
      where: {
        ...(domainId ? { domainId } : {}),
        ...statusFilter
      },
      orderBy: { updatedAt: "desc" }
    });

    return ok({ records: records.map(toDnsRecord) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = normalizeRecordInput(await readBody<Partial<DnsRecordFormInput>>(request));
    const { data, errors } = validateDnsRecordBody(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const domain = await prisma.domain.findUnique({ where: { id: data.domainId } });

    if (!domain) {
      return fail("Domínio não encontrado.", 404);
    }

    const record = await prisma.$transaction(async (tx) => {
      await validateLocalDnsRecordUniqueness(tx, domain.id, domain.name, data);

      const created = await tx.dnsRecord.create({
        data
      });

      await writeAudit(tx, {
        action: "DNS_RECORD_CREATE_LOCAL",
        entityType: "record",
        entityId: created.id,
        entityName: `${created.type} ${created.name}`,
        userId: user.id,
        description: `Registro ${created.type} ${created.name} criado em ${domain.name}.`,
        newData: toDnsRecord(created)
      });

      return created;
    });

    return ok({ record: toDnsRecord(record) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
