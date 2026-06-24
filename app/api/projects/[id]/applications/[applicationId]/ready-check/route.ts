import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import {
  calculateApplicationReadiness,
  decryptEnvironmentVariables,
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
    const application = await prisma.projectApplication.findFirst({
      where: { id: applicationId, projectId: id },
      include: applicationInclude
    });

    if (!application) {
      return fail("Aplicação não encontrada.", 404);
    }

    if (application.status === "ARCHIVED") {
      return fail("Aplicações arquivadas não podem ser validadas.", 400);
    }

    const variables = decryptEnvironmentVariables(application.environmentVariablesEncrypted);
    const readiness = calculateApplicationReadiness(application, variables);
    const nextStatus = application.coolifyApplicationId
      ? "LINKED"
      : readiness.ready
        ? "READY"
        : application.status === "DEPLOYED" || application.status === "FAILED"
          ? application.status
          : "DRAFT";

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.projectApplication.update({
        where: { id: application.id },
        data: { status: nextStatus },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_APPLICATION_READY_CHECK",
        entityType: "project_application",
        entityId: saved.id,
        entityName: saved.name,
        userId: user.id,
        description: readiness.ready
          ? `Aplicação ${saved.name} está pronta para provisionamento futuro.`
          : `Aplicação ${saved.name} ainda possui pendências de prontidão.`,
        newData: {
          readiness,
          application: sanitizeProjectApplicationForAudit(saved)
        }
      });

      return saved;
    });

    return ok({
      message: readiness.ready
        ? "Aplicação pronta para provisionamento futuro."
        : "Aplicação ainda possui pendências.",
      readiness,
      application: toProjectApplication(updated, { includeEnvironmentValues: true })
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
