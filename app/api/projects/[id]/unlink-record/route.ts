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
    const body = await readBody<{ recordId?: string }>(request);
    const recordId = body.recordId?.trim();

    if (!recordId) {
      return fail("Informe o registro DNS para desvincular.");
    }

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const record = await prisma.dnsRecord.findUnique({
      where: { id: recordId },
      include: recordInclude
    });

    if (!record || record.status === "DELETED") {
      return fail("Registro DNS não encontrado.", 404);
    }

    if (record.projectId !== project.id) {
      return fail("Este registro não está vinculado a este projeto.");
    }

    const updatedRecord = await prisma.$transaction(async (tx) => {
      const updated = await tx.dnsRecord.update({
        where: { id: record.id },
        data: { projectId: null },
        include: recordInclude
      });

      await writeAudit(tx, {
        action: "DNS_RECORD_UNLINK_PROJECT",
        entityType: "record",
        entityId: updated.id,
        entityName: `${updated.type} ${updated.name}`,
        userId: user.id,
        description: `Registro ${updated.type} ${updated.name} desvinculado do projeto ${project.name}.`,
        oldData: {
          ...toDnsRecord(record),
          projectId: project.id,
          projectName: project.name
        },
        newData: toDnsRecord(updated)
      });

      return updated;
    });

    return ok({ record: toDnsRecord(updatedRecord) });
  } catch (error) {
    return handleRouteError(error);
  }
}
