import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  getPostgresAdminClientStatus,
  PostgresAdminCredentialError,
  removePostgresAdminCredential,
  sanitizePostgresAdminForAudit,
  savePostgresAdminCredential
} from "@/lib/server/postgres-admin-credential";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import type { PostgresAdminCredentialFormInput } from "@/lib/types";

type SaveCredentialBody = Partial<PostgresAdminCredentialFormInput>;

function normalizeBody(body: SaveCredentialBody): PostgresAdminCredentialFormInput {
  const port = Number(body.port ?? 5432);

  return {
    host: String(body.host ?? "").trim(),
    port: Number.isFinite(port) ? port : 5432,
    maintenanceDatabase: String(body.maintenanceDatabase ?? "postgres").trim(),
    username: String(body.username ?? "").trim(),
    password: body.password ? String(body.password) : undefined,
    sslEnabled: Boolean(body.sslEnabled)
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = normalizeBody(await readBody<SaveCredentialBody>(request));

    const credential = await savePostgresAdminCredential(body, prisma);

    await writeAudit(prisma, {
      action: "POSTGRES_ADMIN_CREDENTIAL_SAVED",
      entityType: "settings",
      userId: user.id,
      entityName: "PostgreSQL Admin",
      description: "Credencial administrativa PostgreSQL salva com sucesso.",
      newData: sanitizePostgresAdminForAudit(credential)
    });

    const postgresAdmin = await getPostgresAdminClientStatus();

    return ok({
      message: "Credencial administrativa PostgreSQL salva com sucesso.",
      postgresAdmin
    });
  } catch (error) {
    if (error instanceof PostgresAdminCredentialError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const removed = await removePostgresAdminCredential(prisma);

    if (!removed) {
      return fail("Nenhuma credencial administrativa PostgreSQL estava configurada.", 400);
    }

    await writeAudit(prisma, {
      action: "POSTGRES_ADMIN_CREDENTIAL_REMOVED",
      entityType: "settings",
      userId: user.id,
      entityName: "PostgreSQL Admin",
      description: "Credencial administrativa PostgreSQL removida com sucesso.",
      newData: { result: "removed" }
    });

    const postgresAdmin = await getPostgresAdminClientStatus();

    return ok({
      message: "Credencial removida com sucesso.",
      postgresAdmin
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
