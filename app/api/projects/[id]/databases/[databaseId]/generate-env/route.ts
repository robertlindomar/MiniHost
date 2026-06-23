import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { buildEnvFile, decryptDatabasePassword, isProjectDatabaseMutableStatus, sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectDatabase } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string; databaseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, databaseId } = await context.params;
    const body = await readBody<{ confirmSensitive?: boolean }>(request);

    if (!body.confirmSensitive) {
      return fail("Confirme a ação sensível para gerar o .env com credenciais.");
    }

    const existing = await prisma.projectDatabase.findFirst({
      where: { id: databaseId, projectId: id }
    });

    if (!existing) {
      return fail("Banco não encontrado.", 404);
    }

    if (!isProjectDatabaseMutableStatus(existing.status)) {
      return fail("Não é possível gerar .env para este banco.");
    }

    const password = decryptDatabasePassword(existing.databasePasswordEncrypted);
    const envContent = buildEnvFile(
      existing.databaseUser,
      password,
      existing.host,
      existing.port,
      existing.databaseName
    );

    await writeAudit(prisma, {
      action: "PROJECT_DATABASE_ENV_GENERATED",
      entityType: "project_database",
      entityId: existing.id,
      entityName: existing.name,
      userId: user.id,
      description: `.env gerado para o banco ${existing.name}.`,
      newData: sanitizeProjectDatabaseForAudit(toProjectDatabase(existing))
    });

    return ok({
      envContent,
      warning: "Este .env contém credenciais sensíveis. Não compartilhe publicamente."
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
