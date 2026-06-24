import { prisma } from "@/lib/prisma";
import { syncCoolifyResources } from "@/lib/server/coolify-cache";
import {
  CoolifyCredentialError,
  hasCoolifyCredential,
  recordCoolifyTestResult
} from "@/lib/server/coolify-credential";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { toCoolifyApplication, toCoolifyProject, toCoolifyServer } from "@/lib/server/mappers";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);

    if (!(await hasCoolifyCredential())) {
      return fail("Configure a URL e o token do Coolify antes de sincronizar recursos.", 400);
    }

    await writeAudit(prisma, {
      action: "COOLIFY_SYNC_START",
      entityType: "coolify",
      userId: user.id,
      entityName: "Coolify",
      description: "Sincronização de recursos Coolify iniciada.",
      newData: { result: "started" }
    });

    try {
      const result = await syncCoolifyResources();
      const message = `Sincronização concluída: ${result.imported.servers} servidores, ${result.imported.projects} projetos e ${result.imported.applications} aplicações atualizados.`;

      await recordCoolifyTestResult("success", message, prisma);

      await writeAudit(prisma, {
        action: "COOLIFY_SYNC_SUCCESS",
        entityType: "coolify",
        userId: user.id,
        entityName: "Coolify",
        description: message,
        newData: {
          result: "success",
          imported: result.imported,
          syncedAt: result.syncedAt
        }
      });

      return ok({
        message,
        syncedAt: result.syncedAt.toISOString(),
        imported: result.imported,
        servers: result.cached.servers.map(toCoolifyServer),
        projects: result.cached.projects.map(toCoolifyProject),
        applications: result.cached.applications.map(toCoolifyApplication)
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível sincronizar recursos do Coolify. Verifique URL, token e permissões.";

      await recordCoolifyTestResult("failed", message, prisma);

      await writeAudit(prisma, {
        action: "COOLIFY_SYNC_FAILED",
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
