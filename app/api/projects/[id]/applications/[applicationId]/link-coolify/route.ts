import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import {
  assertApplicationUsesProjectCoolifyProject,
  getProjectCoolifyProject,
  ProjectCoolifyProjectError
} from "@/lib/server/project-coolify-project";
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
    const body = await readBody<{
      coolifyServerId?: string | null;
      coolifyApplicationId?: string | null;
    }>(request);

    const coolifyApplicationId = body.coolifyApplicationId?.trim();

    if (!coolifyApplicationId) {
      return fail("Selecione uma aplicação sincronizada do Coolify.", 400);
    }

    const application = await prisma.projectApplication.findFirst({
      where: { id: applicationId, projectId: id },
      include: applicationInclude
    });

    if (!application) {
      return fail("Aplicação não encontrada.", 404);
    }

    if (application.status === "ARCHIVED") {
      return fail("Aplicações arquivadas não podem ser vinculadas ao Coolify.", 400);
    }

    const linkedCoolifyProject = await getProjectCoolifyProject(id);

    if (!linkedCoolifyProject) {
      return fail("Crie ou vincule um projeto Coolify ao projeto MiniHost antes de vincular aplicações.", 400);
    }

    const [coolifyApplication, coolifyServer] = await Promise.all([
      prisma.coolifyApplication.findUnique({ where: { id: coolifyApplicationId } }),
      body.coolifyServerId
        ? prisma.coolifyServer.findUnique({ where: { id: body.coolifyServerId } })
        : Promise.resolve(null)
    ]);

    if (!coolifyApplication) {
      return fail("Aplicação do Coolify não encontrada. Sincronize os recursos e tente novamente.", 404);
    }

    if (body.coolifyServerId && !coolifyServer) {
      return fail("Servidor do Coolify não encontrado.", 404);
    }

    if (coolifyApplication.status !== "ACTIVE") {
      return fail("Esta aplicação do Coolify não está ativa no cache local. Sincronize novamente ou escolha outra aplicação.", 400);
    }

    if (linkedCoolifyProject.status !== "ACTIVE") {
      return fail("O projeto Coolify vinculado ao projeto MiniHost não está ativo. Sincronize novamente.", 400);
    }

    if (coolifyServer && coolifyServer.status !== "ACTIVE") {
      return fail("Este servidor do Coolify não está ativo no cache local. Sincronize novamente ou escolha outro servidor.", 400);
    }

    await assertApplicationUsesProjectCoolifyProject(id, linkedCoolifyProject.id);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.projectApplication.update({
        where: { id: application.id },
        data: {
          coolifyServerId: coolifyServer?.id ?? null,
          coolifyProjectId: linkedCoolifyProject.id,
          coolifyApplicationId: coolifyApplication.id,
          status: "LINKED"
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_APPLICATION_LINK_COOLIFY",
        entityType: "project_application",
        entityId: saved.id,
        entityName: saved.name,
        userId: user.id,
        description: `Aplicação ${saved.name} vinculada à aplicação Coolify ${coolifyApplication.name}.`,
        oldData: sanitizeProjectApplicationForAudit(application),
        newData: sanitizeProjectApplicationForAudit(saved)
      });

      return saved;
    });

    return ok({
      message: "Aplicação vinculada ao Coolify com sucesso.",
      application: toProjectApplication(updated, { includeEnvironmentValues: true })
    });
  } catch (error) {
    if (error instanceof ProjectCoolifyProjectError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
