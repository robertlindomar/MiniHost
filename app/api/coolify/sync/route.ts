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

function sumStatus(summary: {
  servers: { active: number; missing: number; removed: number };
  projects: { active: number; missing: number; removed: number };
  applications: { active: number; missing: number; removed: number };
}) {
  return {
    active: summary.servers.active + summary.projects.active + summary.applications.active,
    missing: summary.servers.missing + summary.projects.missing + summary.applications.missing,
    removed: summary.servers.removed + summary.projects.removed + summary.applications.removed
  };
}

function buildSyncMessage(summary: {
  servers: { active: number; missing: number; removed: number };
  projects: { active: number; missing: number; removed: number };
  applications: { active: number; missing: number; removed: number };
}) {
  const parts = [
    `${summary.servers.active} servidores ativos`,
    `${summary.projects.active} projetos ativos`,
    `${summary.applications.active} aplicações ativas`
  ];

  if (summary.servers.missing > 0) parts.push(`${summary.servers.missing} servidores ausentes`);
  if (summary.projects.missing > 0) parts.push(`${summary.projects.missing} projetos ausentes`);
  if (summary.applications.missing > 0) parts.push(`${summary.applications.missing} aplicações ausentes`);
  if (summary.servers.removed > 0) parts.push(`${summary.servers.removed} servidores removidos`);
  if (summary.projects.removed > 0) parts.push(`${summary.projects.removed} projetos removidos`);
  if (summary.applications.removed > 0) parts.push(`${summary.applications.removed} aplicações removidas`);

  return `Sincronização concluída: ${parts.join(", ")}.`;
}

async function countBrokenProjectLinks() {
  return prisma.project.count({
    where: {
      status: { not: "ARCHIVED" },
      coolifyLink: {
        is: {
          OR: [
            {
              coolifyProject: {
                is: {
                  status: { in: ["MISSING", "REMOVED"] }
                }
              }
            },
            {
              coolifyApplication: {
                is: {
                  status: { in: ["MISSING", "REMOVED"] }
                }
              }
            }
          ]
        }
      }
    }
  });
}

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
      const statusTotals = sumStatus(result.reconciliation);
      const brokenProjectLinks = await countBrokenProjectLinks();
      const message = buildSyncMessage(result.reconciliation);

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
          reconciliation: result.reconciliation,
          brokenProjectLinks,
          syncedAt: result.syncedAt
        }
      });

      await writeAudit(prisma, {
        action: "COOLIFY_SYNC_RESOURCE_ACTIVE",
        entityType: "coolify",
        userId: user.id,
        entityName: "Coolify",
        description: `Sincronização Coolify: ${statusTotals.active} recurso(s) ativo(s).`,
        newData: { active: statusTotals.active, reconciliation: result.reconciliation }
      });

      if (statusTotals.missing > 0) {
        await writeAudit(prisma, {
          action: "COOLIFY_SYNC_RESOURCE_MISSING",
          entityType: "coolify",
          userId: user.id,
          entityName: "Coolify",
          description: `Sincronização Coolify: ${statusTotals.missing} recurso(s) ausente(s).`,
          newData: { missing: statusTotals.missing, reconciliation: result.reconciliation }
        });
      }

      if (statusTotals.removed > 0) {
        await writeAudit(prisma, {
          action: "COOLIFY_SYNC_RESOURCE_REMOVED",
          entityType: "coolify",
          userId: user.id,
          entityName: "Coolify",
          description: `Sincronização Coolify: ${statusTotals.removed} recurso(s) removido(s).`,
          newData: { removed: statusTotals.removed, reconciliation: result.reconciliation }
        });
      }

      if (brokenProjectLinks > 0) {
        await writeAudit(prisma, {
          action: "PROJECT_COOLIFY_LINK_BROKEN",
          entityType: "project",
          userId: user.id,
          entityName: "Vínculos Coolify",
          description: `${brokenProjectLinks} projeto(s) MiniHost possuem vínculo Coolify ausente ou removido.`,
          newData: { brokenProjectLinks }
        });
      }

      return ok({
        message,
        syncedAt: result.syncedAt.toISOString(),
        imported: result.imported,
        reconciliation: result.reconciliation,
        brokenProjectLinks,
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
