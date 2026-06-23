import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { toProjectDatabase } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string; databaseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, databaseId } = await context.params;

    const existing = await prisma.projectDatabase.findFirst({
      where: { id: databaseId, projectId: id }
    });

    if (!existing) {
      return fail("Banco não encontrado.", 404);
    }

    if (existing.status === "ARCHIVED" || existing.status === "DESTROYED" || existing.status === "PARTIALLY_DESTROYED") {
      return fail("Este banco não pode ser arquivado.");
    }

    const archivedAt = new Date();

    const database = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectDatabase.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          archivedAt
        }
      });

      await writeAudit(tx, {
        action: "PROJECT_DATABASE_ARCHIVE",
        entityType: "project_database",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: `Banco ${updated.name} arquivado.`,
        oldData: sanitizeProjectDatabaseForAudit(toProjectDatabase(existing)),
        newData: sanitizeProjectDatabaseForAudit(toProjectDatabase(updated))
      });

      return updated;
    });

    return ok({ database: toProjectDatabase(database) });
  } catch (error) {
    return handleRouteError(error);
  }
}
