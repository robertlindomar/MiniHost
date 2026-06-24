import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import {
  buildDatabaseEnvVariables,
  decryptEnvironmentVariables,
  encryptEnvironmentVariables,
  mergeEnvVariables,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit
} from "@/lib/server/project-application";

type RouteContext = {
  params: Promise<{ id: string; applicationId: string }>;
};

const applicationInclude = {
  projectDatabase: true,
  dnsRecord: {
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  coolifyServer: true,
  coolifyProject: true,
  coolifyApplication: true
} as const;

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, applicationId } = await context.params;
    const body = await readBody<{ databaseId?: string }>(request);
    const databaseId = body.databaseId?.trim();

    if (!databaseId) {
      return fail("Selecione um banco PostgreSQL do projeto.", 400);
    }

    const [application, database] = await Promise.all([
      prisma.projectApplication.findFirst({
        where: { id: applicationId, projectId: id },
        include: applicationInclude
      }),
      prisma.projectDatabase.findFirst({
        where: {
          id: databaseId,
          projectId: id,
          status: { notIn: ["ARCHIVED", "DESTROYED", "PARTIALLY_DESTROYED"] }
        }
      })
    ]);

    if (!application) {
      return fail("Aplicação não encontrada.", 404);
    }

    if (!database) {
      return fail("Banco PostgreSQL não encontrado ou indisponível.", 404);
    }

    const previousVariables = decryptEnvironmentVariables(application.environmentVariablesEncrypted);
    const databaseVariables = buildDatabaseEnvVariables(database);
    const mergedVariables = mergeEnvVariables(previousVariables, databaseVariables);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.projectApplication.update({
        where: { id: application.id },
        data: {
          projectDatabaseId: database.id,
          environmentVariablesEncrypted: encryptEnvironmentVariables(mergedVariables)
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_APPLICATION_ENV_UPDATED",
        entityType: "project_application",
        entityId: saved.id,
        entityName: saved.name,
        userId: user.id,
        description: `Variáveis PostgreSQL importadas para ${saved.name}.`,
        oldData: sanitizeEnvVariablesForAudit(previousVariables),
        newData: sanitizeEnvVariablesForAudit(mergedVariables)
      });

      return saved;
    });

    return ok({
      message: "Variáveis do banco importadas com sucesso.",
      application: toProjectApplication(updated, { includeEnvironmentValues: true }),
      auditSafe: sanitizeProjectApplicationForAudit(updated)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
