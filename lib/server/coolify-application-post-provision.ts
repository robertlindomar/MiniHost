import type { ProjectApplicationStatus } from "@prisma/client";
import {
  CoolifyApiError,
  deployApplication,
  getCoolifyApplication,
  updateApplicationEnvs
} from "@/lib/coolify";
import { prisma } from "@/lib/prisma";
import { syncCoolifyResources } from "@/lib/server/coolify-cache";
import {
  decryptEnvironmentVariables,
  isSensitiveEnvKey,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit
} from "@/lib/server/project-application";
import { writeAudit } from "@/lib/server/audit";

export class CoolifyPostProvisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoolifyPostProvisionError";
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

function assertCoolifyApplicationLinked(
  application: NonNullable<Awaited<ReturnType<typeof loadApplication>>>
) {
  if (!application.coolifyApplicationId || !application.coolifyApplication) {
    throw new CoolifyPostProvisionError("Aplicação ainda não está vinculada ao Coolify.");
  }

  if (application.coolifyApplication.status !== "ACTIVE") {
    throw new CoolifyPostProvisionError("Aplicação Coolify ausente ou inativa. Sincronize novamente.");
  }

  if (application.coolifyServer?.status === "REMOVED" || application.coolifyServer?.status === "MISSING") {
    throw new CoolifyPostProvisionError("Servidor Coolify vinculado está ausente ou removido.");
  }

  if (application.coolifyProject?.status === "REMOVED" || application.coolifyProject?.status === "MISSING") {
    throw new CoolifyPostProvisionError("Projeto Coolify vinculado está ausente ou removido.");
  }

  return application.coolifyApplication.coolifyId;
}

async function loadApplication(projectApplicationId: string) {
  return prisma.projectApplication.findUnique({
    where: { id: projectApplicationId },
    include: applicationInclude
  });
}

function resolveStatusFromRemote(remoteStatus?: string | null, fallback: ProjectApplicationStatus = "DEPLOYING") {
  const normalized = remoteStatus?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("running") ||
    normalized.includes("started") ||
    normalized.includes("healthy")
  ) {
    return "DEPLOYED" as const;
  }

  if (
    normalized.includes("deploying") ||
    normalized.includes("building") ||
    normalized.includes("queued") ||
    normalized.includes("progress")
  ) {
    return "DEPLOYING" as const;
  }

  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("unhealthy")) {
    return "FAILED" as const;
  }

  if (normalized.includes("exited") || normalized.includes("stopped")) {
    return fallback;
  }

  return fallback;
}

export async function syncProjectApplicationCoolifyStatus(projectApplicationId: string) {
  const application = await loadApplication(projectApplicationId);

  if (!application?.coolifyApplication) {
    return application;
  }

  const coolifyUuid = application.coolifyApplication.coolifyId;
  let remoteStatus: string | undefined;

  try {
    const remote = await getCoolifyApplication(coolifyUuid);
    remoteStatus = remote?.status;
  } catch {
    remoteStatus = application.coolifyApplication.remoteStatus ?? undefined;
  }

  await syncCoolifyResources();

  const refreshedCache = await prisma.coolifyApplication.findUnique({
    where: { coolifyId: coolifyUuid }
  });

  const syncedRemoteStatus = refreshedCache?.remoteStatus ?? remoteStatus;
  const now = new Date();
  const nextStatus = resolveStatusFromRemote(
    syncedRemoteStatus,
    application.status === "ENVS_APPLIED" ? "ENVS_APPLIED" : application.status === "LINKED" ? "LINKED" : "DEPLOYING"
  );

  return prisma.projectApplication.update({
    where: { id: projectApplicationId },
    data: {
      status: nextStatus,
      lastCoolifySyncAt: now,
      lastDeployStatus: syncedRemoteStatus ? "SYNCED" : application.lastDeployStatus,
      lastDeployMessage: syncedRemoteStatus
        ? `Status Coolify: ${syncedRemoteStatus}`
        : application.lastDeployMessage
    },
    include: applicationInclude
  });
}

export async function applyEnvsToCoolifyApplication(input: {
  projectApplicationId: string;
  userId: string;
}) {
  const application = await loadApplication(input.projectApplicationId);

  if (!application) {
    throw new CoolifyPostProvisionError("Aplicação planejada não encontrada.");
  }

  if (application.archivedAt) {
    throw new CoolifyPostProvisionError("Aplicações arquivadas não podem receber variáveis no Coolify.");
  }

  const coolifyUuid = assertCoolifyApplicationLinked(application);
  const environmentVariables = decryptEnvironmentVariables(application.environmentVariablesEncrypted);
  const now = new Date();

  if (environmentVariables.length === 0) {
    const updated = await prisma.projectApplication.update({
      where: { id: application.id },
      data: {
        lastEnvsApplyStatus: "SKIPPED",
        lastEnvsApplyMessage: "Sem variáveis para aplicar",
        lastCoolifySyncAt: now
      },
      include: applicationInclude
    });

    return {
      application: updated,
      message: "Sem variáveis para aplicar.",
      skipped: true
    };
  }

  await writeAudit(prisma, {
    action: "COOLIFY_APPLICATION_ENVS_APPLY_START",
    entityType: "project_application",
    entityId: application.id,
    entityName: application.name,
    userId: input.userId,
    description: `Iniciando aplicação de variáveis na aplicação ${application.name} no Coolify.`,
    newData: {
      coolifyApplicationId: coolifyUuid,
      environmentVariables: sanitizeEnvVariablesForAudit(environmentVariables)
    }
  });

  try {
    const result = await updateApplicationEnvs(coolifyUuid, environmentVariables);
    const successMessage = "Variáveis aplicadas no Coolify com sucesso.";

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.projectApplication.update({
        where: { id: application.id },
        data: {
          status: "ENVS_APPLIED",
          envsAppliedAt: now,
          lastEnvsApplyStatus: "SUCCESS",
          lastEnvsApplyMessage: successMessage,
          lastCoolifySyncAt: now
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "COOLIFY_APPLICATION_ENVS_APPLY_SUCCESS",
        entityType: "project_application",
        entityId: saved.id,
        entityName: saved.name,
        userId: input.userId,
        description: successMessage,
        newData: {
          coolifyApplicationId: coolifyUuid,
          appliedCount: result.count,
          environmentVariables: sanitizeEnvVariablesForAudit(environmentVariables)
        }
      });

      return saved;
    });

    return {
      application: updated,
      message: successMessage,
      skipped: false
    };
  } catch (error) {
    const message =
      error instanceof CoolifyApiError
        ? error.message
        : "Não foi possível aplicar variáveis no Coolify.";

    const updated = await prisma.projectApplication.update({
      where: { id: application.id },
      data: {
        lastEnvsApplyStatus: "FAILED",
        lastEnvsApplyMessage: message
      },
      include: applicationInclude
    });

    await writeAudit(prisma, {
      action: "COOLIFY_APPLICATION_ENVS_APPLY_FAILED",
      entityType: "project_application",
      entityId: application.id,
      entityName: application.name,
      userId: input.userId,
      description: message,
      newData: {
        coolifyApplicationId: coolifyUuid,
        status: "FAILED",
        environmentVariables: sanitizeEnvVariablesForAudit(environmentVariables)
      }
    });

    throw new CoolifyPostProvisionError(message);
  }
}

export async function deployCoolifyApplication(input: {
  projectApplicationId: string;
  userId: string;
}) {
  const application = await loadApplication(input.projectApplicationId);

  if (!application) {
    throw new CoolifyPostProvisionError("Aplicação planejada não encontrada.");
  }

  if (application.archivedAt) {
    throw new CoolifyPostProvisionError("Aplicações arquivadas não podem receber deploy.");
  }

  const coolifyUuid = assertCoolifyApplicationLinked(application);
  const now = new Date();

  await writeAudit(prisma, {
    action: "COOLIFY_APPLICATION_DEPLOY_START",
    entityType: "project_application",
    entityId: application.id,
    entityName: application.name,
    userId: input.userId,
    description: `Iniciando deploy da aplicação ${application.name} no Coolify.`,
    newData: {
      coolifyApplicationId: coolifyUuid,
      previousStatus: application.status
    }
  });

  try {
    await deployApplication(coolifyUuid);

    const deploying = await prisma.projectApplication.update({
      where: { id: application.id },
      data: {
        status: "DEPLOYING",
        lastDeployStartedAt: now,
        lastDeployStatus: "STARTED",
        lastDeployMessage: "Deploy iniciado com sucesso."
      },
      include: applicationInclude
    });

    const synced = (await syncProjectApplicationCoolifyStatus(application.id).catch(() => deploying)) ?? deploying;
    const successMessage = "Deploy iniciado com sucesso.";

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.projectApplication.update({
        where: { id: application.id },
        data: {
          lastDeployStatus: synced.lastDeployStatus ?? "STARTED",
          lastDeployMessage: successMessage,
          lastCoolifySyncAt: synced.lastCoolifySyncAt ?? now,
          status: synced.status
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "COOLIFY_APPLICATION_DEPLOY_SUCCESS",
        entityType: "project_application",
        entityId: saved.id,
        entityName: saved.name,
        userId: input.userId,
        description: successMessage,
        oldData: sanitizeProjectApplicationForAudit(application),
        newData: sanitizeProjectApplicationForAudit(saved)
      });

      return saved;
    });

    return {
      application: updated,
      message: successMessage
    };
  } catch (error) {
    const message =
      error instanceof CoolifyApiError
        ? error.message
        : "Não foi possível iniciar deploy no Coolify.";

    const updated = await prisma.projectApplication.update({
      where: { id: application.id },
      data: {
        lastDeployStatus: "FAILED",
        lastDeployMessage: message
      },
      include: applicationInclude
    });

    await writeAudit(prisma, {
      action: "COOLIFY_APPLICATION_DEPLOY_FAILED",
      entityType: "project_application",
      entityId: application.id,
      entityName: application.name,
      userId: input.userId,
      description: message,
      newData: {
        coolifyApplicationId: coolifyUuid,
        status: updated.status,
        lastDeployMessage: message
      }
    });

    throw new CoolifyPostProvisionError(message);
  }
}

export function maskEnvKeysForPreview(keys: string[]) {
  return keys.map((key) => ({
    key,
    masked: isSensitiveEnvKey(key)
  }));
}
