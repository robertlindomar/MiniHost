import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import {
  calculateApplicationReadiness,
  decryptEnvironmentVariables,
  encryptEnvironmentVariables,
  normalizeProjectApplicationInput,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit,
  validateProjectApplicationInput
} from "@/lib/server/project-application";
import type { ProjectApplicationFormInput } from "@/lib/types";

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

async function getApplication(projectId: string, applicationId: string) {
  return prisma.projectApplication.findFirst({
    where: { id: applicationId, projectId },
    include: applicationInclude
  });
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
      return "Banco do projeto não encontrado ou indisponível.";
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
    const { id, applicationId } = await context.params;
    const application = await getApplication(id, applicationId);

    if (!application) {
      return fail("Aplicação não encontrada.", 404);
    }

    return ok({ application: toProjectApplication(application, { includeEnvironmentValues: true }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, applicationId } = await context.params;
    const existing = await getApplication(id, applicationId);

    if (!existing) {
      return fail("Aplicação não encontrada.", 404);
    }

    if (existing.status === "ARCHIVED") {
      return fail("Aplicações arquivadas não podem ser editadas.", 400);
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
        slug: input.slug,
        id: { not: existing.id }
      }
    });

    if (duplicate) {
      return fail("Já existe uma aplicação com esse slug neste projeto.", 409);
    }

    const previousEnv = decryptEnvironmentVariables(existing.environmentVariablesEncrypted);
    const envChanged = JSON.stringify(previousEnv) !== JSON.stringify(input.environmentVariables);
    const readiness = calculateApplicationReadiness(
      {
        ...input,
        projectDatabaseId: input.projectDatabaseId,
        coolifyApplicationId: existing.coolifyApplicationId
      },
      input.environmentVariables
    );

    const nextStatus = existing.coolifyApplicationId
      ? "LINKED"
      : readiness.ready
        ? "READY"
        : existing.status === "DEPLOYED" || existing.status === "FAILED"
          ? existing.status
          : "DRAFT";

    const updated = await prisma.$transaction(async (tx) => {
      const application = await tx.projectApplication.update({
        where: { id: existing.id },
        data: {
          projectDatabaseId: input.projectDatabaseId,
          dnsRecordId: input.dnsRecordId,
          name: input.name,
          slug: input.slug,
          type: input.type,
          status: nextStatus,
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
        action: "PROJECT_APPLICATION_UPDATE",
        entityType: "project_application",
        entityId: application.id,
        entityName: application.name,
        userId: user.id,
        description: `Aplicação ${application.name} atualizada.`,
        oldData: sanitizeProjectApplicationForAudit(existing),
        newData: sanitizeProjectApplicationForAudit(application)
      });

      if (envChanged) {
        await writeAudit(tx, {
          action: "PROJECT_APPLICATION_ENV_UPDATED",
          entityType: "project_application",
          entityId: application.id,
          entityName: application.name,
          userId: user.id,
          description: `Variáveis de ambiente atualizadas para ${application.name}.`,
          oldData: sanitizeEnvVariablesForAudit(previousEnv),
          newData: sanitizeEnvVariablesForAudit(input.environmentVariables)
        });
      }

      return application;
    });

    return ok({ application: toProjectApplication(updated, { includeEnvironmentValues: true }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
