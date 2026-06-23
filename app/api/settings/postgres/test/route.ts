import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  hasPostgresAdminCredential,
  PostgresAdminCredentialError,
  recordPostgresAdminTestResult
} from "@/lib/server/postgres-admin-credential";
import { testPostgresConnection } from "@/lib/server/postgres-provisioner";
import { fail, handleRouteError, ok } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);

    if (!(await hasPostgresAdminCredential())) {
      return fail("Configure a credencial administrativa PostgreSQL antes de testar a conexão.", 400);
    }

    try {
      await testPostgresConnection();
      const message = "Conexão PostgreSQL testada com sucesso.";

      await recordPostgresAdminTestResult("success", message, prisma);

      await writeAudit(prisma, {
        action: "POSTGRES_ADMIN_TEST_SUCCESS",
        entityType: "settings",
        userId: user.id,
        entityName: "PostgreSQL Admin",
        description: message,
        newData: { result: "success" }
      });

      return ok({ message });
    } catch (error) {
      const message =
        error instanceof PostgresAdminCredentialError
          ? error.message
          : "Não foi possível conectar ao PostgreSQL. Verifique host, porta, usuário e senha.";

      await recordPostgresAdminTestResult("failed", message, prisma);

      await writeAudit(prisma, {
        action: "POSTGRES_ADMIN_TEST_FAILED",
        entityType: "settings",
        userId: user.id,
        entityName: "PostgreSQL Admin",
        description: message,
        newData: { result: "failed" }
      });

      return fail(message, 400);
    }
  } catch (error) {
    if (error instanceof PostgresAdminCredentialError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
