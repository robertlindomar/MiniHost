import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import {
  PostgresProvisionerError,
  verifyProjectDatabasePermissions
} from "@/lib/server/postgres-provisioner";
import { sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";

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

    const verification = await verifyProjectDatabasePermissions(existing.id);

    await writeAudit(prisma, {
      action: "PROJECT_DATABASE_PERMISSIONS_VERIFIED",
      entityType: "project_database",
      entityId: existing.id,
      entityName: existing.name,
      userId: user.id,
      description: verification.ok
        ? `Permissões do banco ${existing.databaseName} verificadas com sucesso.`
        : `Permissões do banco ${existing.databaseName} precisam de correção.`,
      newData: sanitizeProjectDatabaseForAudit({
        databaseName: existing.databaseName,
        databaseUser: existing.databaseUser,
        ok: verification.ok,
        connectableDatabases: verification.connectableDatabases,
        unexpectedDatabases: verification.unexpectedDatabases
      })
    });

    return ok({
      message: verification.ok
        ? "Permissões corretas: o usuário só pode conectar ao banco do projeto."
        : "Foram encontrados bancos extras com CONNECT para o usuário do projeto.",
      verification
    });
  } catch (error) {
    if (error instanceof PostgresProvisionerError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
