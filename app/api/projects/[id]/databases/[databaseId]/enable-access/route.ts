import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { toProjectDatabase } from "@/lib/server/mappers";
import {
  enableProjectDatabaseAccess,
  PostgresProvisionerError
} from "@/lib/server/postgres-provisioner";

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

    const updated = await enableProjectDatabaseAccess(existing.id, user.id);

    await writeAudit(prisma, {
      action: "PROJECT_DATABASE_ENABLE_ACCESS",
      entityType: "project_database",
      entityId: updated.id,
      entityName: updated.name,
      userId: user.id,
      description: `Acesso reativado para o usuário ${updated.databaseUser} no banco ${updated.databaseName}.`,
      oldData: sanitizeProjectDatabaseForAudit(toProjectDatabase(existing)),
      newData: sanitizeProjectDatabaseForAudit(toProjectDatabase(updated))
    });

    return ok({
      message: "Acesso ao banco reativado com sucesso.",
      database: toProjectDatabase(updated)
    });
  } catch (error) {
    if (error instanceof PostgresProvisionerError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
