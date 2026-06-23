import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord, toDomain } from "@/lib/server/mappers";
import { validateDomainInput } from "@/lib/server/validation";
import type { DomainFormInput } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeDomainInput(body: Partial<DomainFormInput>): DomainFormInput {
  return {
    name: String(body.name ?? ""),
    provider: String(body.provider ?? ""),
    zoneId: body.zoneId ? String(body.zoneId) : "",
    status: body.status === "inactive" ? "inactive" : "active"
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = normalizeDomainInput(await readBody<Partial<DomainFormInput>>(request));
    const { data, errors } = validateDomainInput(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const domain = await prisma.$transaction(async (tx) => {
      const current = await tx.domain.findUnique({ where: { id } });

      if (!current) {
        throw new Error("Domínio não encontrado.");
      }

      const duplicate = await tx.domain.findUnique({ where: { name: data.name } });

      if (duplicate && duplicate.id !== id) {
        throw new Error("Já existe um domínio com esse nome.");
      }

      const updated = await tx.domain.update({
        where: { id },
        data
      });

      await writeAudit(tx, {
        action: "Domínio editado",
        entityType: "domain",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: `Domínio ${updated.name} atualizado no banco.`,
        oldData: toDomain(current),
        newData: toDomain(updated)
      });

      return updated;
    });

    return ok({ domain: toDomain(domain) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.domain.findUnique({
        where: { id },
        include: { records: true }
      });

      if (!current) {
        throw new Error("Domínio não encontrado.");
      }

      await tx.domain.delete({ where: { id } });

      await writeAudit(tx, {
        action: "Domínio excluído",
        entityType: "domain",
        entityId: current.id,
        entityName: current.name,
        userId: user.id,
        description:
          current.records.length > 0
            ? `Domínio ${current.name} excluído do banco com ${current.records.length} registro(s) associado(s).`
            : `Domínio ${current.name} excluído do banco.`,
        oldData: {
          domain: toDomain(current),
          records: current.records.map(toDnsRecord)
        }
      });

      return current;
    });

    return ok({ domain: toDomain(result) });
  } catch (error) {
    return handleRouteError(error);
  }
}
