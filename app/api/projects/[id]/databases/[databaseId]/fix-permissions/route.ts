import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { buildFixPermissionsConfirmationText } from "@/lib/provision";
import {
  fixProjectDatabasePermissions,
  PostgresProvisionerError
} from "@/lib/server/postgres-provisioner";
import { sanitizeProjectDatabaseForAudit } from "@/lib/server/project-database";

type RouteContext = {
  params: Promise<{ id: string; databaseId: string }>;
};

type FixPermissionsBody = {
  confirmationText?: string;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, databaseId } = await context.params;
    const body = await readBody<FixPermissionsBody>(request);
    const confirmationText = String(body.confirmationText ?? "").trim();

    const existing = await prisma.projectDatabase.findFirst({
      where: { id: databaseId, projectId: id }
    });

    if (!existing) {
      return fail("Banco não encontrado.", 404);
    }

    const expectedConfirmation = buildFixPermissionsConfirmationText(existing.databaseName);

    if (confirmationText !== expectedConfirmation) {
      return fail(`Digite exatamente: ${expectedConfirmation}`, 400);
    }

    const verification = await fixProjectDatabasePermissions(existing.id);

    await writeAudit(prisma, {
      action: "PROJECT_DATABASE_PERMISSIONS_FIXED",
      entityType: "project_database",
      entityId: existing.id,
      entityName: existing.name,
      userId: user.id,
      description: verification.ok
        ? `Permissões do banco ${existing.databaseName} corrigidas com sucesso.`
        : `Permissões do banco ${existing.databaseName} corrigidas, mas ainda há alertas.`,
      newData: sanitizeProjectDatabaseForAudit({
        databaseName: existing.databaseName,
        databaseUser: existing.databaseUser,
        ok: verification.ok,
        connectableDatabases: verification.connectableDatabases,
        unexpectedDatabases: verification.unexpectedDatabases,
        publicConnectWarnings: verification.publicConnectWarnings
      })
    });

    return ok({
      message: verification.ok
        ? "Permissões corrigidas e verificadas com sucesso."
        : "Correção aplicada, mas ainda há bancos com CONNECT via PUBLIC.",
      verification
    });
  } catch (error) {
    if (error instanceof PostgresProvisionerError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
