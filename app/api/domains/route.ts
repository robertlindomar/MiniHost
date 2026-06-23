import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDomain } from "@/lib/server/mappers";
import { validateDomainInput } from "@/lib/server/validation";
import type { DomainFormInput } from "@/lib/types";

function normalizeDomainInput(body: Partial<DomainFormInput>): DomainFormInput {
  return {
    name: String(body.name ?? ""),
    provider: String(body.provider ?? ""),
    zoneId: body.zoneId ? String(body.zoneId) : "",
    status: body.status === "inactive" ? "inactive" : "active"
  };
}

export async function GET() {
  try {
    const domains = await prisma.domain.findMany({
      orderBy: { createdAt: "desc" }
    });

    return ok({ domains: domains.map(toDomain) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = normalizeDomainInput(await readBody<Partial<DomainFormInput>>(request));
    const { data, errors } = validateDomainInput(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const duplicate = await prisma.domain.findUnique({ where: { name: data.name } });

    if (duplicate) {
      return fail("Já existe um domínio com esse nome.", 409);
    }

    const domain = await prisma.$transaction(async (tx) => {
      const created = await tx.domain.create({
        data
      });

      await writeAudit(tx, {
        action: "Domínio criado",
        entityType: "domain",
        entityId: created.id,
        entityName: created.name,
        description: `Domínio ${created.name} cadastrado no banco.`,
        newData: toDomain(created)
      });

      return created;
    });

    return ok({ domain: toDomain(domain) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
