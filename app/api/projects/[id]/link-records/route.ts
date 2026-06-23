import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const recordInclude = {
  project: {
    select: {
      id: true,
      name: true
    }
  }
} as const;

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = await readBody<{ recordIds?: string[] }>(request);
    const recordIds = Array.isArray(body.recordIds) ? body.recordIds.filter(Boolean) : [];

    if (recordIds.length === 0) {
      return fail("Selecione ao menos um registro DNS para vincular.");
    }

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    if (project.status === "ARCHIVED") {
      return fail("Não é possível vincular registros a um projeto arquivado.");
    }

    const records = await prisma.dnsRecord.findMany({
      where: {
        id: { in: recordIds },
        status: { not: "DELETED" }
      },
      include: recordInclude
    });

    if (records.length === 0) {
      return fail("Nenhum registro DNS válido foi encontrado.");
    }

    const updatedRecords = await prisma.$transaction(async (tx) => {
      const linked = [];

      for (const record of records) {
        const updated = await tx.dnsRecord.update({
          where: { id: record.id },
          data: { projectId: project.id },
          include: recordInclude
        });

        await writeAudit(tx, {
          action: "DNS_RECORD_LINK_PROJECT",
          entityType: "record",
          entityId: updated.id,
          entityName: `${updated.type} ${updated.name}`,
          userId: user.id,
          description: `Registro ${updated.type} ${updated.name} vinculado ao projeto ${project.name}.`,
          oldData: {
            ...toDnsRecord(record),
            projectId: record.projectId,
            projectName: record.project?.name
          },
          newData: {
            ...toDnsRecord(updated),
            projectId: project.id,
            projectName: project.name
          }
        });

        linked.push(updated);
      }

      return linked;
    });

    return ok({
      records: updatedRecords.map(toDnsRecord),
      linkedCount: updatedRecords.length
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
