import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import {
  buildApplicationWithoutDatabaseWarning,
  calculateApplicationReadiness,
  encryptEnvironmentVariables,
  normalizeProjectApplicationInput,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit,
  validateProjectApplicationInput
} from "@/lib/server/project-application";
import type { ProjectApplicationFormInput } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
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

async function assertProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    return null;
  }

  if (project.status === "ARCHIVED") {
    throw new Error("Não é possível gerenciar aplicações de um projeto arquivado.");
  }

  return project;
}

async function validateRelations(projectId: string, input: ReturnType<typeof normalizeProjectApplicationInput>) {
  if (input.projectDatabaseId) {
    const database = await prisma.projectDatabase.findFirst({
      where: {
        id: input.projectDatabaseId,
        projectId,
        status: { notIn: ["ARCHIVED", "DESTROYED", "PARTIALLY_DESTROYED"] }
      }
    });

    if (!database) {
      return "Banco vinculado não encontrado.";
    }
  }

  if (input.dnsRecordId) {
    const record = await prisma.dnsRecord.findFirst({
      where: {
        id: input.dnsRecordId,
        projectId,
        status: { not: "DELETED" }
      }
    });

    if (!record) {
      return "Registro DNS vinculado ao projeto não encontrado.";
    }
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const applications = await prisma.projectApplication.findMany({
      where: { projectId: id },
      include: applicationInclude,
      orderBy: { createdAt: "desc" }
    });

    return ok({ applications: applications.map((application) => toProjectApplication(application)) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const project = await assertProject(id);

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const input = normalizeProjectApplicationInput(await readBody<Partial<ProjectApplicationFormInput>>(request));
    const errors = validateProjectApplicationInput(input);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const relationError = await validateRelations(id, input);

    if (relationError) {
      return fail(relationError, 400);
    }

    const duplicate = await prisma.projectApplication.findFirst({
      where: {
        projectId: id,
        slug: input.slug
      }
    });

    if (duplicate) {
      return fail("Já existe uma aplicação com esse slug neste projeto.", 409);
    }

    const readiness = calculateApplicationReadiness(
      {
        name: input.name,
        slug: input.slug,
        type: input.type,
        gitRepository: input.gitRepository,
        gitBranch: input.gitBranch,
        domain: input.domain,
        port: input.port,
        buildCommand: input.buildCommand,
        startCommand: input.startCommand,
        outputDirectory: input.outputDirectory,
        projectDatabaseId: input.projectDatabaseId,
        coolifyApplicationId: null
      },
      input.environmentVariables
    );

    const created = await prisma.$transaction(async (tx) => {
      const application = await tx.projectApplication.create({
        data: {
          projectId: id,
          projectDatabaseId: input.projectDatabaseId,
          dnsRecordId: input.dnsRecordId,
          name: input.name,
          slug: input.slug,
          type: input.type,
          status: readiness.ready ? "READY" : "DRAFT",
          gitRepository: input.gitRepository,
          gitBranch: input.gitBranch,
          rootDirectory: input.rootDirectory,
          buildCommand: input.buildCommand,
          startCommand: input.startCommand,
          installCommand: input.installCommand,
          outputDirectory: input.outputDirectory,
          port: input.port,
          domain: input.domain,
          notes: input.notes,
          environmentVariablesEncrypted: encryptEnvironmentVariables(input.environmentVariables)
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_APPLICATION_CREATE",
        entityType: "project_application",
        entityId: application.id,
        entityName: application.name,
        userId: user.id,
        description: `Aplicação ${application.name} planejada para o projeto ${project.name}.`,
        newData: sanitizeProjectApplicationForAudit(application)
      });

      if (input.environmentVariables.length > 0) {
        await writeAudit(tx, {
          action: "PROJECT_APPLICATION_ENV_UPDATED",
          entityType: "project_application",
          entityId: application.id,
          entityName: application.name,
          userId: user.id,
          description: `Variáveis de ambiente configuradas para ${application.name}.`,
          newData: sanitizeEnvVariablesForAudit(input.environmentVariables)
        });
      }

      return application;
    });

    return ok(
      {
        application: toProjectApplication(created, { includeEnvironmentValues: true }),
        warning: buildApplicationWithoutDatabaseWarning(input.type, input.projectDatabaseId)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("projeto arquivado")) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
