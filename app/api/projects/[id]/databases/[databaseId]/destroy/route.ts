import { buildDestroyConfirmationText } from "@/lib/database-danger";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { DatabaseGuardError } from "@/lib/server/postgres-guard";
import { sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectDatabase } from "@/lib/server/mappers";
import {
  destroyProjectDatabase,
  PostgresProvisionerError
} from "@/lib/server/postgres-provisioner";

type RouteContext = {
  params: Promise<{ id: string; databaseId: string }>;
};

type DestroyBody = {
  confirmationText?: string;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, databaseId } = await context.params;
    const body = await readBody<DestroyBody>(request);
    const confirmationText = String(body.confirmationText ?? "").trim();

    const existing = await prisma.projectDatabase.findFirst({
      where: { id: databaseId, projectId: id },
      include: { project: true }
    });

    if (!existing) {
      return fail("Banco não encontrado.", 404);
    }

    const expectedConfirmation = buildDestroyConfirmationText(existing.databaseName);

    if (confirmationText !== expectedConfirmation) {
      return fail(`Digite exatamente: ${expectedConfirmation}`, 400);
    }

    await writeAudit(prisma, {
      action: "PROJECT_DATABASE_DESTROY_START",
      entityType: "project_database",
      entityId: existing.id,
      entityName: existing.name,
      userId: user.id,
      description: `Iniciando destruição do banco ${existing.databaseName} e usuário ${existing.databaseUser}.`,
      newData: sanitizeProjectDatabaseForAudit({
        databaseName: existing.databaseName,
        databaseUser: existing.databaseUser,
        host: existing.host,
        port: existing.port,
        projectName: existing.project.name
      })
    });

    try {
      const updated = await destroyProjectDatabase(existing.id, user.id);
      const mapped = toProjectDatabase(updated);
      const isPartial = updated.status === "PARTIALLY_DESTROYED";

      await writeAudit(prisma, {
        action: isPartial ? "PROJECT_DATABASE_DESTROY_PARTIAL" : "PROJECT_DATABASE_DESTROY_SUCCESS",
        entityType: "project_database",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: isPartial
          ? `Banco ${updated.databaseName} removido, mas o usuário ${updated.databaseUser} precisa de revisão manual.`
          : `Banco ${updated.databaseName} e usuário ${updated.databaseUser} destruídos com sucesso.`,
        newData: sanitizeProjectDatabaseForAudit(mapped)
      });

      return ok({
        message: isPartial
          ? "Banco removido, mas não foi possível remover o usuário completamente."
          : "Banco e usuário destruídos com sucesso.",
        database: mapped
      });
    } catch (error) {
      const message =
        error instanceof PostgresProvisionerError || error instanceof DatabaseGuardError
          ? error.message
          : "Não foi possível destruir o banco PostgreSQL.";

      await writeAudit(prisma, {
        action: "PROJECT_DATABASE_DESTROY_FAILED",
        entityType: "project_database",
        entityId: existing.id,
        entityName: existing.name,
        userId: user.id,
        description: message,
        newData: sanitizeProjectDatabaseForAudit({
          databaseName: existing.databaseName,
          databaseUser: existing.databaseUser,
          status: existing.status
        })
      });

      return fail(message, 400);
    }
  } catch (error) {
    if (error instanceof DatabaseGuardError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
