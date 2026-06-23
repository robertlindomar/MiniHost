import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { toProjectDatabase } from "@/lib/server/mappers";
import { hasPostgresAdminCredential } from "@/lib/server/postgres-admin-credential";
import {
  buildProvisionConfirmationText,
  createProjectDatabase,
  PostgresProvisionerError
} from "@/lib/server/postgres-provisioner";
import { sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";

type ProvisionBody = {
  projectDatabaseId?: string;
  confirmationText?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<ProvisionBody>(request);
    const projectDatabaseId = String(body.projectDatabaseId ?? "").trim();
    const confirmationText = String(body.confirmationText ?? "").trim();

    if (!projectDatabaseId) {
      return fail("Informe o banco planejado a provisionar.", 400);
    }

    const database = await prisma.projectDatabase.findUnique({
      where: { id: projectDatabaseId },
      include: { project: true }
    });

    if (!database) {
      return fail("Banco planejado não encontrado.", 404);
    }

    if (database.status !== "PLANNED" && database.status !== "CREATED_MANUALLY" && database.status !== "FAILED") {
      return fail("Este banco não pode ser provisionado no status atual.", 400);
    }

    if (!(await hasPostgresAdminCredential())) {
      return fail("Configure a credencial administrativa PostgreSQL em Configurações.", 400);
    }

    const expectedConfirmation = buildProvisionConfirmationText(database.databaseName);

    if (confirmationText !== expectedConfirmation) {
      return fail(`Digite exatamente: ${expectedConfirmation}`, 400);
    }

    await writeAudit(prisma, {
      action: "PROJECT_DATABASE_PROVISION_START",
      entityType: "project_database",
      entityId: database.id,
      userId: user.id,
      entityName: database.name,
      description: `Iniciando provisionamento do banco ${database.databaseName}.`,
      newData: sanitizeProjectDatabaseForAudit({
        databaseName: database.databaseName,
        databaseUser: database.databaseUser,
        host: database.host,
        port: database.port,
        projectName: database.project.name
      })
    });

    try {
      const provisioned = await createProjectDatabase(projectDatabaseId, user.id);
      const mapped = toProjectDatabase(provisioned);

      await writeAudit(prisma, {
        action: "PROJECT_DATABASE_PROVISION_SUCCESS",
        entityType: "project_database",
        entityId: provisioned.id,
        userId: user.id,
        entityName: provisioned.name,
        description: `Banco ${provisioned.databaseName} provisionado com sucesso.`,
        newData: sanitizeProjectDatabaseForAudit(mapped)
      });

      return ok({
        message: `Banco ${provisioned.databaseName} criado com sucesso.`,
        database: mapped
      });
    } catch (error) {
      const message =
        error instanceof PostgresProvisionerError
          ? error.message
          : "Não foi possível provisionar o banco PostgreSQL.";

      const failed = await prisma.projectDatabase.findUnique({
        where: { id: projectDatabaseId }
      });

      await writeAudit(prisma, {
        action: "PROJECT_DATABASE_PROVISION_FAILED",
        entityType: "project_database",
        entityId: database.id,
        userId: user.id,
        entityName: database.name,
        description: message,
        newData: sanitizeProjectDatabaseForAudit({
          databaseName: database.databaseName,
          status: failed?.status ?? "FAILED",
          lastProvisionError: failed?.lastProvisionError ?? message
        })
      });

      return fail(message, 400);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
