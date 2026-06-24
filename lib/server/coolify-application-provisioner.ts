import type { ProjectApplicationType } from "@prisma/client";
import {
  createPublicRepositoryApplication,
  CoolifyApiError
} from "@/lib/coolify";
import { buildCoolifyCreatePayload } from "@/lib/coolify-provision";
import { prisma } from "@/lib/prisma";
import {
  applyEnvsToCoolifyApplication,
  deployCoolifyApplication
} from "@/lib/server/coolify-application-post-provision";
import { syncCoolifyResources } from "@/lib/server/coolify-cache";
import {
  decryptEnvironmentVariables,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit
} from "@/lib/server/project-application";
import { writeAudit } from "@/lib/server/audit";

export class CoolifyApplicationProvisionerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoolifyApplicationProvisionerError";
  }
}

const applicationInclude = {
  project: true,
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

const LINKED_SUCCESS_MESSAGE =
  "Aplicação criada no Coolify. Aplique variáveis e execute deploy para iniciar.";

export async function provisionCoolifyApplication(input: {
  projectApplicationId: string;
  coolifyServerId: string;
  coolifyProjectId: string;
  userId: string;
  applyEnvsAfterCreate?: boolean;
  deployAfterCreate?: boolean;
}) {
  const application = await prisma.projectApplication.findUnique({
    where: { id: input.projectApplicationId },
    include: applicationInclude
  });

  if (!application) {
    throw new CoolifyApplicationProvisionerError("Aplicação planejada não encontrada.");
  }

  if (application.archivedAt) {
    throw new CoolifyApplicationProvisionerError("Aplicações arquivadas não podem ser criadas no Coolify.");
  }

  if (application.coolifyApplicationId) {
    throw new CoolifyApplicationProvisionerError("Esta aplicação já possui vínculo com o Coolify.");
  }

  if (
    application.status === "LINKED" ||
    application.status === "DEPLOYED" ||
    application.status === "ENVS_APPLIED" ||
    application.status === "DEPLOYING"
  ) {
    throw new CoolifyApplicationProvisionerError("Aplicação já vinculada ou implantada no Coolify.");
  }

  const [coolifyServer, coolifyProject] = await Promise.all([
    prisma.coolifyServer.findUnique({ where: { id: input.coolifyServerId } }),
    prisma.coolifyProject.findUnique({ where: { id: input.coolifyProjectId } })
  ]);

  if (!coolifyServer) {
    throw new CoolifyApplicationProvisionerError("Servidor Coolify não encontrado no cache local.");
  }

  if (!coolifyProject) {
    throw new CoolifyApplicationProvisionerError("Projeto Coolify não encontrado no cache local.");
  }

  if (coolifyServer.status !== "ACTIVE") {
    throw new CoolifyApplicationProvisionerError("Servidor Coolify selecionado está ausente ou removido. Sincronize novamente.");
  }

  if (coolifyProject.status !== "ACTIVE") {
    throw new CoolifyApplicationProvisionerError("Projeto Coolify selecionado está ausente ou removido. Sincronize novamente.");
  }

  const environmentVariables = decryptEnvironmentVariables(application.environmentVariablesEncrypted);
  const payload = buildCoolifyCreatePayload(
    {
      name: application.name,
      type: application.type as ProjectApplicationType,
      gitRepository: application.gitRepository!,
      gitBranch: application.gitBranch!,
      rootDirectory: application.rootDirectory,
      buildCommand: application.buildCommand,
      startCommand: application.startCommand,
      installCommand: application.installCommand,
      outputDirectory: application.outputDirectory,
      port: application.port,
      domain: application.domain
    },
    coolifyServer.coolifyId,
    coolifyProject.coolifyId
  );

  await writeAudit(prisma, {
    action: "COOLIFY_APPLICATION_CREATE_START",
    entityType: "project_application",
    entityId: application.id,
    entityName: application.name,
    userId: input.userId,
    description: `Iniciando criação da aplicação ${application.name} no Coolify.`,
    newData: {
      projectName: application.project.name,
      coolifyServer: coolifyServer.name,
      coolifyProject: coolifyProject.name,
      gitRepository: application.gitRepository,
      gitBranch: application.gitBranch,
      domain: application.domain,
      port: application.port,
      type: application.type,
      applyEnvsAfterCreate: Boolean(input.applyEnvsAfterCreate),
      deployAfterCreate: Boolean(input.deployAfterCreate),
      environmentVariables: sanitizeEnvVariablesForAudit(environmentVariables)
    }
  });

  try {
    const created = await createPublicRepositoryApplication(payload);
    await syncCoolifyResources();

    const cachedApplication = await prisma.coolifyApplication.findUnique({
      where: { coolifyId: created.uuid }
    });

    const now = new Date();

    let updated = await prisma.$transaction(async (tx) => {
      let coolifyApplicationCacheId = cachedApplication?.id ?? null;

      if (!coolifyApplicationCacheId) {
        const fallback = await tx.coolifyApplication.create({
          data: {
            coolifyId: created.uuid,
            name: created.name ?? application.name,
            fqdn: created.fqdn ?? application.domain,
            status: "ACTIVE",
            gitRepository: application.gitRepository,
            branch: application.gitBranch,
            lastSeenAt: now,
            lastSyncedAt: now,
            rawData: {
              uuid: created.uuid,
              name: created.name ?? application.name,
              source: "minihost-provision"
            }
          }
        });
        coolifyApplicationCacheId = fallback.id;
      }

      const saved = await tx.projectApplication.update({
        where: { id: application.id },
        data: {
          coolifyServerId: coolifyServer.id,
          coolifyProjectId: coolifyProject.id,
          coolifyApplicationId: coolifyApplicationCacheId,
          status: "LINKED",
          provisionedAt: now,
          provisionedBy: input.userId,
          lastProvisionStatus: "SUCCESS",
          lastProvisionMessage: LINKED_SUCCESS_MESSAGE,
          lastCoolifySyncAt: now
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "COOLIFY_APPLICATION_CREATE_SUCCESS",
        entityType: "coolify",
        entityId: coolifyApplicationCacheId ?? undefined,
        entityName: created.name ?? application.name,
        userId: input.userId,
        description: "Aplicação criada no Coolify com sucesso.",
        newData: {
          coolifyApplicationId: created.uuid,
          coolifyProject: coolifyProject.name,
          coolifyServer: coolifyServer.name,
          status: "LINKED"
        }
      });

      await writeAudit(tx, {
        action: "PROJECT_APPLICATION_PROVISIONED_COOLIFY",
        entityType: "project_application",
        entityId: saved.id,
        entityName: saved.name,
        userId: input.userId,
        description: `Aplicação ${saved.name} provisionada no Coolify.`,
        oldData: sanitizeProjectApplicationForAudit(application),
        newData: sanitizeProjectApplicationForAudit(saved)
      });

      return saved;
    });

    const warnings: string[] = [];

    if (environmentVariables.length > 0 && !input.applyEnvsAfterCreate) {
      warnings.push("Aplicação criada, mas variáveis ainda não foram aplicadas.");
    }

    if (!input.deployAfterCreate) {
      warnings.push("Aplicação criada, mas deploy ainda não foi iniciado.");
    }

    if (input.applyEnvsAfterCreate) {
      try {
        const envResult = await applyEnvsToCoolifyApplication({
          projectApplicationId: updated.id,
          userId: input.userId
        });
        updated = envResult.application;
      } catch (error) {
        warnings.push(
          error instanceof Error ? error.message : "Não foi possível aplicar variáveis no Coolify."
        );
      }
    }

    if (input.deployAfterCreate) {
      try {
        const deployResult = await deployCoolifyApplication({
          projectApplicationId: updated.id,
          userId: input.userId
        });
        updated = deployResult.application;
      } catch (error) {
        warnings.push(
          error instanceof Error ? error.message : "Não foi possível iniciar deploy no Coolify."
        );
      }
    }

    const envWarning = warnings.length > 0 ? warnings.join(" ") : undefined;

    return {
      application: updated,
      message: LINKED_SUCCESS_MESSAGE,
      envWarning,
      coolifyApplicationUuid: created.uuid
    };
  } catch (error) {
    const message =
      error instanceof CoolifyApiError
        ? error.message
        : error instanceof CoolifyApplicationProvisionerError
          ? error.message
          : "Não foi possível criar a aplicação no Coolify.";

    await prisma.projectApplication.update({
      where: { id: application.id },
      data: {
        status: "FAILED",
        lastProvisionStatus: "FAILED",
        lastProvisionMessage: message
      }
    });

    await writeAudit(prisma, {
      action: "COOLIFY_APPLICATION_CREATE_FAILED",
      entityType: "project_application",
      entityId: application.id,
      entityName: application.name,
      userId: input.userId,
      description: message,
      newData: {
        status: "FAILED",
        lastProvisionMessage: message
      }
    });

    throw new CoolifyApplicationProvisionerError(message);
  }
}
