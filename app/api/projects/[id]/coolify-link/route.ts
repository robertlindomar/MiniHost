import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import {
  ensureProjectCoolifyProject,
  ProjectCoolifyProjectError,
  unlinkProjectCoolifyProject
} from "@/lib/server/project-coolify-project";
import { toProjectCoolifyLink } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LinkBody = {
  coolifyProjectId?: string | null;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id: projectId } = await context.params;
    const body = await readBody<LinkBody>(request);
    const coolifyProjectId = body.coolifyProjectId?.trim() || null;

    if (!coolifyProjectId) {
      return fail("Selecione um projeto Coolify para vincular.", 400);
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    if (project.status === "ARCHIVED") {
      return fail("Projetos arquivados não podem ser vinculados ao Coolify.");
    }

    const link = await ensureProjectCoolifyProject(projectId, coolifyProjectId, user.id, {
      source: "MANUAL_LINK"
    });

    return ok({
      message: "Projeto Coolify vinculado com sucesso.",
      coolifyLink: toProjectCoolifyLink(link)
    });
  } catch (error) {
    if (error instanceof ProjectCoolifyProjectError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id: projectId } = await context.params;

    await unlinkProjectCoolifyProject(projectId, user.id);

    return ok({ message: "Vínculo com projeto Coolify removido com sucesso." });
  } catch (error) {
    if (error instanceof ProjectCoolifyProjectError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
