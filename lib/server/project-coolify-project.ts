import type { CoolifyProject, ProjectCoolifyLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { isCoolifyResourceCreatedByMiniHost } from "@/lib/server/coolify-resource";
import { toProjectCoolifyLink } from "@/lib/server/mappers";

export type ProjectCoolifyLinkSource = "PUBLISH" | "MANUAL_LINK" | "BACKFILL" | "IMPORT";

export class ProjectCoolifyProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectCoolifyProjectError";
  }
}

const coolifyLinkInclude = {
  coolifyProject: true
} as const;

type CoolifyLinkWithProject = ProjectCoolifyLink & {
  coolifyProject: CoolifyProject | null;
};

export type ProjectCoolifyInconsistency = {
  code:
    | "MISSING_PROJECT_LINK"
    | "LINK_APP_MISMATCH"
    | "APPS_DIFFERENT_PROJECTS"
    | "LINK_POINTS_TO_REMOVED"
    | "APP_POINTS_TO_REMOVED";
  message: string;
  details?: Record<string, unknown>;
};

export type ProjectCoolifyInconsistencyReport = {
  hasInconsistency: boolean;
  items: ProjectCoolifyInconsistency[];
  suggestedCoolifyProjectIds: string[];
};

export async function getProjectCoolifyProject(projectId: string) {
  const link = await prisma.projectCoolifyLink.findUnique({
    where: { projectId },
    include: coolifyLinkInclude
  });

  return link?.coolifyProject ?? null;
}

export async function getProjectCoolifyLink(projectId: string) {
  return prisma.projectCoolifyLink.findUnique({
    where: { projectId },
    include: coolifyLinkInclude
  });
}

/** Corrige links legados em que createdByMiniHost ficou false mas o cache ainda marca origem MiniHost. */
export async function repairProjectCoolifyLinkCreatedByMiniHost(projectId: string) {
  const link = await prisma.projectCoolifyLink.findUnique({
    where: { projectId },
    include: coolifyLinkInclude
  });

  if (!link || link.createdByMiniHost || !link.coolifyProject) {
    return;
  }

  if (!isCoolifyResourceCreatedByMiniHost(link.coolifyProject.rawData)) {
    return;
  }

  await prisma.projectCoolifyLink.update({
    where: { id: link.id },
    data: { createdByMiniHost: true }
  });
}

export async function assertApplicationUsesProjectCoolifyProject(
  projectId: string,
  coolifyProjectCacheId: string
) {
  const link = await prisma.projectCoolifyLink.findUnique({
    where: { projectId },
    include: coolifyLinkInclude
  });

  if (!link?.coolifyProjectCacheId) {
    return;
  }

  if (link.coolifyProjectCacheId !== coolifyProjectCacheId) {
    const linkedName = link.coolifyProject?.name ?? link.coolifyProjectCacheId;
    throw new ProjectCoolifyProjectError(
      `Esta aplicação deve usar o projeto Coolify vinculado ao projeto MiniHost (${linkedName}).`
    );
  }
}

export async function ensureProjectCoolifyProject(
  projectId: string,
  coolifyProjectCacheId: string,
  userId: string,
  options?: {
    source?: ProjectCoolifyLinkSource;
    createdByMiniHost?: boolean;
    allowReplace?: boolean;
  }
): Promise<CoolifyLinkWithProject> {
  const [project, coolifyProject, existingLink, provisionedAppsCount] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.coolifyProject.findUnique({ where: { id: coolifyProjectCacheId } }),
    prisma.projectCoolifyLink.findUnique({
      where: { projectId },
      include: coolifyLinkInclude
    }),
    prisma.projectApplication.count({
      where: {
        projectId,
        coolifyApplicationId: { not: null },
        archivedAt: null
      }
    })
  ]);

  if (!project) {
    throw new ProjectCoolifyProjectError("Projeto não encontrado.");
  }

  if (!coolifyProject) {
    throw new ProjectCoolifyProjectError("Projeto Coolify não encontrado no cache local.");
  }

  if (coolifyProject.status !== "ACTIVE") {
    throw new ProjectCoolifyProjectError("O projeto Coolify selecionado não está ativo no cache local.");
  }

  if (
    existingLink?.coolifyProjectCacheId &&
    existingLink.coolifyProjectCacheId !== coolifyProjectCacheId
  ) {
    if (provisionedAppsCount > 0 && !options?.allowReplace) {
      const linkedName = existingLink.coolifyProject?.name ?? existingLink.coolifyProjectCacheId;
      throw new ProjectCoolifyProjectError(
        `Este projeto MiniHost já está vinculado ao projeto Coolify ${linkedName}.`
      );
    }
  }

  const createdByMiniHost =
    options?.createdByMiniHost ?? isCoolifyResourceCreatedByMiniHost(coolifyProject.rawData);

  const saved = await prisma.$transaction(async (tx) => {
    const link = await tx.projectCoolifyLink.upsert({
      where: { projectId },
      create: {
        projectId,
        coolifyProjectCacheId,
        source: options?.source ?? "MANUAL_LINK",
        createdByMiniHost
      },
      update: {
        coolifyProjectCacheId,
        source: options?.source ?? existingLink?.source ?? "MANUAL_LINK",
        createdByMiniHost: existingLink?.createdByMiniHost || createdByMiniHost
      },
      include: coolifyLinkInclude
    });

    await tx.projectApplication.updateMany({
      where: {
        projectId,
        archivedAt: null
      },
      data: {
        coolifyProjectId: coolifyProjectCacheId
      }
    });

    if (!existingLink?.coolifyProjectCacheId || existingLink.coolifyProjectCacheId !== coolifyProjectCacheId) {
      await writeAudit(tx, {
        action: "PROJECT_COOlify_PROJECT_LINKED",
        entityType: "project",
        entityId: project.id,
        entityName: project.name,
        userId,
        description: `Projeto MiniHost vinculado ao projeto Coolify ${coolifyProject.name}.`,
        oldData: existingLink ? toProjectCoolifyLink(existingLink) : null,
        newData: {
          coolifyProjectCacheId,
          coolifyProjectName: coolifyProject.name,
          source: options?.source ?? "MANUAL_LINK",
          createdByMiniHost
        }
      });
    }

    return link;
  });

  return saved;
}

export async function unlinkProjectCoolifyProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      coolifyLink: { include: coolifyLinkInclude },
      applications: {
        where: {
          coolifyApplicationId: { not: null },
          archivedAt: null
        }
      }
    }
  });

  if (!project) {
    throw new ProjectCoolifyProjectError("Projeto não encontrado.");
  }

  if (!project.coolifyLink) {
    throw new ProjectCoolifyProjectError("Este projeto não possui vínculo com projeto Coolify.");
  }

  if (project.applications.length > 0) {
    throw new ProjectCoolifyProjectError(
      "Não é possível remover o vínculo enquanto existirem aplicações provisionadas no Coolify."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectCoolifyLink.delete({ where: { projectId } });

    await writeAudit(tx, {
      action: "PROJECT_COOlify_PROJECT_UNLINKED",
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
      userId,
      description: `Vínculo com projeto Coolify removido do projeto ${project.name}.`,
      oldData: toProjectCoolifyLink(project.coolifyLink!),
      newData: { result: "removed" }
    });
  });
}

export async function detectProjectCoolifyInconsistencies(
  projectId: string
): Promise<ProjectCoolifyInconsistencyReport> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      coolifyLink: { include: coolifyLinkInclude },
      applications: {
        where: { archivedAt: null },
        include: { coolifyProject: true }
      }
    }
  });

  if (!project) {
    throw new ProjectCoolifyProjectError("Projeto não encontrado.");
  }

  const items: ProjectCoolifyInconsistency[] = [];
  const appCoolifyProjectIds = [
    ...new Set(
      project.applications
        .map((app) => app.coolifyProjectId)
        .filter((id): id is string => Boolean(id))
    )
  ];

  const linkProjectId = project.coolifyLink?.coolifyProjectCacheId ?? null;

  if (appCoolifyProjectIds.length > 0 && !linkProjectId) {
    items.push({
      code: "MISSING_PROJECT_LINK",
      message: "Projeto possui aplicações Coolify, mas não possui vínculo de projeto Coolify.",
      details: { applicationCoolifyProjectIds: appCoolifyProjectIds }
    });
  }

  if (appCoolifyProjectIds.length > 1) {
    items.push({
      code: "APPS_DIFFERENT_PROJECTS",
      message: "Aplicações do mesmo projeto MiniHost apontam para projetos Coolify diferentes.",
      details: { applicationCoolifyProjectIds: appCoolifyProjectIds }
    });
  }

  if (linkProjectId && appCoolifyProjectIds.some((id) => id !== linkProjectId)) {
    items.push({
      code: "LINK_APP_MISMATCH",
      message: "O vínculo do projeto MiniHost não coincide com o projeto Coolify de alguma aplicação.",
      details: { linkProjectId, applicationCoolifyProjectIds: appCoolifyProjectIds }
    });
  }

  if (project.coolifyLink?.coolifyProject && ["MISSING", "REMOVED"].includes(project.coolifyLink.coolifyProject.status)) {
    items.push({
      code: "LINK_POINTS_TO_REMOVED",
      message: "O projeto Coolify vinculado está ausente ou removido no cache local.",
      details: { coolifyProjectId: project.coolifyLink.coolifyProject.id }
    });
  }

  for (const application of project.applications) {
    if (application.coolifyProject && ["MISSING", "REMOVED"].includes(application.coolifyProject.status)) {
      items.push({
        code: "APP_POINTS_TO_REMOVED",
        message: `A aplicação ${application.name} aponta para um projeto Coolify ausente ou removido.`,
        details: { applicationId: application.id, coolifyProjectId: application.coolifyProject.id }
      });
    }
  }

  const suggestedCoolifyProjectIds = [
    ...new Set([linkProjectId, ...appCoolifyProjectIds].filter((id): id is string => Boolean(id)))
  ];

  return {
    hasInconsistency: items.length > 0,
    items,
    suggestedCoolifyProjectIds
  };
}

export async function backfillProjectCoolifyLink(projectId: string, userId: string) {
  const report = await detectProjectCoolifyInconsistencies(projectId);

  if (!report.hasInconsistency) {
    return { status: "skipped" as const, message: "Nenhum backfill necessário." };
  }

  const onlyMissingLink =
    report.items.length === 1 && report.items[0]?.code === "MISSING_PROJECT_LINK";
  const appProjectIds = report.items.find((item) => item.code === "MISSING_PROJECT_LINK")?.details
    ?.applicationCoolifyProjectIds as string[] | undefined;

  if (!onlyMissingLink || !appProjectIds || appProjectIds.length !== 1) {
    await writeAudit(prisma, {
      action: "PROJECT_COOlify_BACKFILL_INCONSISTENCY",
      entityType: "project",
      entityId: projectId,
      description: "Backfill automático não aplicado devido a inconsistência Coolify.",
      userId,
      newData: { items: report.items }
    });

    return {
      status: "inconsistent" as const,
      message: "Não foi possível aplicar backfill automático. Corrija a inconsistência manualmente.",
      report
    };
  }

  const coolifyProjectCacheId = appProjectIds[0]!;
  const coolifyProject = await prisma.coolifyProject.findUnique({ where: { id: coolifyProjectCacheId } });

  const link = await ensureProjectCoolifyProject(projectId, coolifyProjectCacheId, userId, {
    source: "BACKFILL",
    createdByMiniHost: isCoolifyResourceCreatedByMiniHost(coolifyProject?.rawData),
    allowReplace: true
  });

  await writeAudit(prisma, {
    action: "PROJECT_COOlify_BACKFILL_SUCCESS",
    entityType: "project",
    entityId: projectId,
    userId,
    description: "Vínculo de projeto Coolify criado por backfill.",
    newData: toProjectCoolifyLink(link)
  });

  return {
    status: "success" as const,
    message: "Vínculo de projeto Coolify restaurado por backfill.",
    link: toProjectCoolifyLink(link)
  };
}

export async function fixProjectCoolifyInconsistency(
  projectId: string,
  userId: string,
  strategy: "from_project_link" | "from_first_app" | "clear_broken_link"
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      coolifyLink: { include: coolifyLinkInclude },
      applications: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!project) {
    throw new ProjectCoolifyProjectError("Projeto não encontrado.");
  }

  if (strategy === "clear_broken_link") {
    if (!project.coolifyLink) {
      throw new ProjectCoolifyProjectError("Este projeto não possui vínculo local para remover.");
    }

    await prisma.projectCoolifyLink.delete({ where: { projectId } });

    await writeAudit(prisma, {
      action: "PROJECT_COOlify_INCONSISTENCY_FIXED",
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
      userId,
      description: "Vínculo Coolify local quebrado removido.",
      newData: { strategy }
    });

    return { message: "Vínculo local removido." };
  }

  if (strategy === "from_project_link") {
    const linkProjectId = project.coolifyLink?.coolifyProjectCacheId;

    if (!linkProjectId) {
      throw new ProjectCoolifyProjectError("O projeto não possui vínculo Coolify para usar como referência.");
    }

    await prisma.projectApplication.updateMany({
      where: { projectId, archivedAt: null },
      data: { coolifyProjectId: linkProjectId }
    });

    await writeAudit(prisma, {
      action: "PROJECT_COOlify_INCONSISTENCY_FIXED",
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
      userId,
      description: "Aplicações alinhadas ao projeto Coolify vinculado ao projeto MiniHost.",
      newData: { strategy, coolifyProjectCacheId: linkProjectId }
    });

    return { message: "Aplicações alinhadas ao projeto Coolify do vínculo." };
  }

  const firstAppWithProject = project.applications.find((app) => app.coolifyProjectId);

  if (!firstAppWithProject?.coolifyProjectId) {
    throw new ProjectCoolifyProjectError("Nenhuma aplicação com projeto Coolify encontrada.");
  }

  const coolifyProject = await prisma.coolifyProject.findUnique({
    where: { id: firstAppWithProject.coolifyProjectId }
  });

  const link = await ensureProjectCoolifyProject(projectId, firstAppWithProject.coolifyProjectId, userId, {
    source: "BACKFILL",
    createdByMiniHost: isCoolifyResourceCreatedByMiniHost(coolifyProject?.rawData),
    allowReplace: true
  });

  await writeAudit(prisma, {
    action: "PROJECT_COOlify_INCONSISTENCY_FIXED",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    userId,
    description: "Vínculo do projeto MiniHost corrigido usando a primeira aplicação provisionada.",
    newData: { strategy, link: toProjectCoolifyLink(link) }
  });

  return {
    message: "Vínculo corrigido usando o projeto Coolify da primeira aplicação.",
    link: toProjectCoolifyLink(link)
  };
}
