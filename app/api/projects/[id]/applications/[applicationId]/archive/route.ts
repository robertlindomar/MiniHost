import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import { sanitizeProjectApplicationForAudit } from "@/lib/server/project-application";

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

    const existing = await prisma.projectApplication.findFirst({
      where: { id: applicationId, projectId: id },
      include: applicationInclude
    });

    if (!existing) {
      return fail("Aplicação não encontrada.", 404);
    }

    if (existing.status === "ARCHIVED") {
      return fail("Aplicação já está arquivada.", 400);
    }

    const application = await prisma.$transaction(async (tx) => {
      const archived = await tx.projectApplication.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date()
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_APPLICATION_ARCHIVE",
        entityType: "project_application",
        entityId: archived.id,
        entityName: archived.name,
        userId: user.id,
        description: `Aplicação ${archived.name} arquivada.`,
        oldData: sanitizeProjectApplicationForAudit(existing),
        newData: sanitizeProjectApplicationForAudit(archived)
      });

      return archived;
    });

    return ok({ application: toProjectApplication(application) });
  } catch (error) {
    return handleRouteError(error);
  }
}
