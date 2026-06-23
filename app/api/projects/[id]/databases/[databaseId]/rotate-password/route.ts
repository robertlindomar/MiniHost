import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  buildConnectionUrl,
  decryptDatabasePassword,
  encryptDatabasePassword,
  generateDatabasePassword,
  isProjectDatabaseMutableStatus,
  sanitizeProjectDatabaseForAudit
} from "@/lib/server/project-database";
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

    if (!isProjectDatabaseMutableStatus(existing.status)) {
      return fail("Não é possível rotacionar senha deste banco.");
    }

    const plainPassword = generateDatabasePassword();
    const passwordEncrypted = encryptDatabasePassword(plainPassword);
    const connectionUrlEncrypted = encryptDatabasePassword(
      buildConnectionUrl(
        existing.databaseUser,
        plainPassword,
        existing.host,
        existing.port,
        existing.databaseName
      )
    );

    const database = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectDatabase.update({
        where: { id: existing.id },
        data: {
          databasePasswordEncrypted: passwordEncrypted,
          connectionUrlEncrypted
        }
      });

      await writeAudit(tx, {
        action: "PROJECT_DATABASE_PASSWORD_ROTATED",
        entityType: "project_database",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: `Senha do banco ${updated.name} rotacionada.`,
        oldData: sanitizeProjectDatabaseForAudit(toProjectDatabase(existing)),
        newData: sanitizeProjectDatabaseForAudit(toProjectDatabase(updated))
      });

      return updated;
    });

    return ok({
      database: toProjectDatabase(database),
      generatedPassword: plainPassword
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
