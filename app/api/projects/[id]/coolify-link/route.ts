import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectCoolifyLink } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LinkBody = {
  coolifyProjectId?: string | null;
  coolifyApplicationId?: string | null;
};

const coolifyLinkInclude = {
  coolifyProject: true,
  coolifyApplication: true
} as const;

function normalizeBody(body: LinkBody) {
  return {
    coolifyProjectId: body.coolifyProjectId?.trim() || null,
    coolifyApplicationId: body.coolifyApplicationId?.trim() || null
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id: projectId } = await context.params;
    const body = normalizeBody(await readBody<LinkBody>(request));

    if (!body.coolifyProjectId && !body.coolifyApplicationId) {
      return fail("Selecione um projeto ou aplicação do Coolify para vincular.", 400);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        coolifyLink: {
          include: coolifyLinkInclude
        }
      }
    });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    if (project.status === "ARCHIVED") {
      return fail("Projetos arquivados não podem ser vinculados ao Coolify.");
    }

    const [coolifyProject, coolifyApplication] = await Promise.all([
      body.coolifyProjectId
        ? prisma.coolifyProject.findUnique({ where: { id: body.coolifyProjectId } })
        : Promise.resolve(null),
      body.coolifyApplicationId
        ? prisma.coolifyApplication.findUnique({ where: { id: body.coolifyApplicationId } })
        : Promise.resolve(null)
    ]);

    if (body.coolifyProjectId && !coolifyProject) {
      return fail("Projeto do Coolify não encontrado. Sincronize os recursos e tente novamente.", 404);
    }

    if (body.coolifyApplicationId && !coolifyApplication) {
      return fail("Aplicação do Coolify não encontrada. Sincronize os recursos e tente novamente.", 404);
    }

    const link = await prisma.$transaction(async (tx) => {
      const saved = await tx.projectCoolifyLink.upsert({
        where: { projectId },
        create: {
          projectId,
          coolifyProjectCacheId: body.coolifyProjectId,
          coolifyApplicationCacheId: body.coolifyApplicationId
        },
        update: {
          coolifyProjectCacheId: body.coolifyProjectId,
          coolifyApplicationCacheId: body.coolifyApplicationId
        },
        include: coolifyLinkInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_COOLIFY_LINK_CREATED",
        entityType: "project",
        entityId: project.id,
        entityName: project.name,
        userId: user.id,
        description: `Projeto ${project.name} vinculado ao Coolify.`,
        oldData: project.coolifyLink ? toProjectCoolifyLink(project.coolifyLink) : null,
        newData: toProjectCoolifyLink(saved)
      });

      return saved;
    });

    return ok({
      message: "Vínculo com Coolify salvo com sucesso.",
      coolifyLink: toProjectCoolifyLink(link)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id: projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        coolifyLink: {
          include: coolifyLinkInclude
        }
      }
    });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const existingLink = project.coolifyLink;

    if (!existingLink) {
      return fail("Este projeto não possui vínculo com Coolify.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectCoolifyLink.delete({
        where: { projectId }
      });

      await writeAudit(tx, {
        action: "PROJECT_COOLIFY_LINK_REMOVED",
        entityType: "project",
        entityId: project.id,
        entityName: project.name,
        userId: user.id,
        description: `Vínculo Coolify removido do projeto ${project.name}.`,
        oldData: toProjectCoolifyLink(existingLink),
        newData: { result: "removed" }
      });
    });

    return ok({ message: "Vínculo com Coolify removido com sucesso." });
  } catch (error) {
    return handleRouteError(error);
  }
}
