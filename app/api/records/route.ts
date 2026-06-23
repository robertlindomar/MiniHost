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
    priority: body.priority === undefined || body.priority === null ? undefined : Number(body.priority),
    templateName: body.templateName ? String(body.templateName) : undefined,
    projectId: body.projectId ? String(body.projectId) : undefined,
    fromProjectTemplate: Boolean(body.fromProjectTemplate)
  };
}

const recordInclude = {
  project: {
    select: {
      id: true,
      name: true
    }
  }
} as const;

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
      include: recordInclude,
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

    if (data.projectId) {
      const project = await prisma.project.findUnique({ where: { id: data.projectId } });

      if (!project) {
        return fail("Projeto não encontrado.", 404);
      }

      if (project.status === "ARCHIVED") {
        return fail("Não é possível vincular registros a um projeto arquivado.");
      }
    }

    const record = await prisma.$transaction(async (tx) => {
      await validateLocalDnsRecordUniqueness(tx, domain.id, domain.name, data);

      const created = await tx.dnsRecord.create({
        data,
        include: recordInclude
      });

      const action = body.fromProjectTemplate
        ? "DNS_RECORD_CREATE_FROM_PROJECT_TEMPLATE"
        : body.templateName
          ? "DNS_RECORD_CREATE_FROM_TEMPLATE_LOCAL"
          : "DNS_RECORD_CREATE_LOCAL";

      const description = body.fromProjectTemplate
        ? `Registro ${created.type} ${created.name} criado em ${domain.name} pelo template ${body.templateName} no projeto.`
        : body.templateName
          ? `Registro ${created.type} ${created.name} criado em ${domain.name} pelo template ${body.templateName}.`
          : `Registro ${created.type} ${created.name} criado em ${domain.name}.`;

      await writeAudit(tx, {
        action,
        entityType: "record",
        entityId: created.id,
        entityName: `${created.type} ${created.name}`,
        userId: user.id,
        description,
        newData: {
          ...toDnsRecord(created),
          templateName: body.templateName,
          projectId: data.projectId,
          projectName: created.project?.name,
          domain: domain.name
        }
      });

      return created;
    });

    return ok({ record: toDnsRecord(record) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
