import { testCoolifyConnection } from "@/lib/coolify";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  CoolifyCredentialError,
  hasCoolifyCredential,
  recordCoolifyTestResult
} from "@/lib/server/coolify-credential";
import { fail, handleRouteError, ok } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);

    if (!(await hasCoolifyCredential())) {
      return fail("Configure a URL e o token do Coolify antes de testar a conexão.", 400);
    }

    try {
      await testCoolifyConnection();
      const message = "Conexão Coolify testada com sucesso.";

      await recordCoolifyTestResult("success", message, prisma);

      await writeAudit(prisma, {
        action: "COOLIFY_TEST_SUCCESS",
        entityType: "coolify",
        userId: user.id,
        entityName: "Coolify",
        description: message,
        newData: { result: "success" }
      });

      return ok({ message });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível conectar ao Coolify. Verifique URL, token e permissões.";

      await recordCoolifyTestResult("failed", message, prisma);

      await writeAudit(prisma, {
        action: "COOLIFY_TEST_FAILED",
        entityType: "coolify",
        userId: user.id,
        entityName: "Coolify",
        description: message,
        newData: { result: "failed" }
      });

      return fail(message, 400);
    }
  } catch (error) {
    if (error instanceof CoolifyCredentialError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
