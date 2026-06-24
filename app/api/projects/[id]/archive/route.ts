import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { toProject } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const projectInclude = {
  _count: {
    select: {
      records: {
        where: { status: { not: "DELETED" } }
      }
    }
  }
} as const;

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;

    const existing = await prisma.project.findUnique({
      where: { id },
      include: projectInclude
    });

    if (!existing) {
      return fail("Projeto não encontrado.", 404);
    }

    if (existing.status === "ARCHIVED") {
      return fail("Este projeto já está arquivado.");
    }

    if (existing.status === "TERMINATING") {
      return fail("Este projeto está em encerramento. Aguarde a conclusão.");
    }

    const archivedAt = new Date();

    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt
        },
        include: projectInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_ARCHIVE",
        entityType: "project",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: `Projeto ${updated.name} arquivado. Os registros DNS vinculados foram mantidos.`,
        oldData: toProject(existing),
        newData: toProject(updated)
      });

      return updated;
    });

    return ok({ project: toProject(project) });
  } catch (error) {
    return handleRouteError(error);
  }
}
