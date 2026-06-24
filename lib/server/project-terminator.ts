import type { ProjectDatabaseStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { CoolifyApiError, deleteCoolifyApplication, deleteCoolifyProject } from "@/lib/coolify";
import { prisma } from "@/lib/prisma";
import {
  TERMINATE_STEP_LABELS,
  type ProjectTerminateInput,
  type ProjectTerminateResult,
  type TerminateOptions,
  type TerminateStepId,
  type TerminateStepResult,
  type TerminationPendingItem,
  isValidProjectTerminateConfirmation
} from "@/lib/terminate";
import { writeAudit } from "@/lib/server/audit";
import { syncCoolifyResources } from "@/lib/server/coolify-cache";
import { isCoolifyResourceCreatedByMiniHost, resolveProjectCoolifyProjects } from "@/lib/server/coolify-resource";
import { deleteProjectDnsRecord } from "@/lib/server/dns-record-delete";
import { destroyProjectDatabase } from "@/lib/server/postgres-provisioner";
import { DatabaseGuardError } from "@/lib/server/postgres-guard";
import {
  assertApplicationTerminationAllowed,
  assertCoolifyProjectDeletionAllowed,
  assertDatabaseTerminationAllowed,
  assertDnsRecordTerminationAllowed,
  assertProjectTerminationAllowed,
  ProjectGuardError
} from "@/lib/server/project-guard";
import { defaultSettings, toProject, toSettings } from "@/lib/server/mappers";

export class ProjectTerminatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectTerminatorError";
  }
}

const projectInclude = {
  coolifyLink: {
    include: {
      coolifyProject: true,
      coolifyApplication: true
    }
  },
  records: {
    where: { status: { not: "DELETED" } },
    include: { domain: true }
  },
  applications: {
    where: { archivedAt: null },
    include: {
      coolifyApplication: true,
      coolifyProject: true
    }
  },
  databases: {
    where: {
      status: { notIn: ["ARCHIVED", "DESTROYED"] as ProjectDatabaseStatus[] }
    }
  }
};

function createInitialSteps(): TerminateStepResult[] {
  return (Object.keys(TERMINATE_STEP_LABELS) as TerminateStepId[]).map((id) => ({
    id,
    label: TERMINATE_STEP_LABELS[id],
    status: "pending"
  }));
}

function setStep(
  steps: TerminateStepResult[],
  id: TerminateStepId,
  status: TerminateStepResult["status"],
  message?: string
) {
  const step = steps.find((item) => item.id === id);

  if (step) {
    step.status = status;
    step.message = message;
  }
}

function parseStoredPending(value: unknown): TerminationPendingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TerminationPendingItem => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as TerminationPendingItem;

    return (
      (candidate.type === "dns" ||
        candidate.type === "coolify_app" ||
        candidate.type === "coolify_project" ||
        candidate.type === "database") &&
      typeof candidate.id === "string" &&
      typeof candidate.error === "string"
    );
  });
}

function shouldProcessPending(
  retryPendingOnly: boolean,
  pending: TerminationPendingItem[],
  type: TerminationPendingItem["type"],
  id: string
) {
  if (!retryPendingOnly) {
    return true;
  }

  return pending.some((item) => item.type === type && item.id === id);
}

export async function terminateProject(input: ProjectTerminateInput & { userId: string }): Promise<ProjectTerminateResult> {
  const steps = createInitialSteps();
  const pending: TerminationPendingItem[] = [];
  const options = input.options;

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: projectInclude
  });

  if (!project) {
    throw new ProjectTerminatorError("Projeto não encontrado.");
  }

  const storedPending = parseStoredPending(project.terminationPending);
  const retryPendingOnly = Boolean(input.retryPendingOnly);

  if (!input.understandRisk) {
    throw new ProjectTerminatorError("Confirme que entende os riscos desta ação.");
  }

  if (!isValidProjectTerminateConfirmation(project.slug, input.confirmationText)) {
    throw new ProjectTerminatorError(`Digite exatamente "encerrar ${project.slug}" para confirmar.`);
  }

  try {
    await assertProjectTerminationAllowed(project);
  } catch (error) {
    if (error instanceof ProjectGuardError) {
      setStep(steps, "validate", "error", error.message);
      throw new ProjectTerminatorError(error.message);
    }

    throw error;
  }

  setStep(steps, "validate", "running");

  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: "TERMINATING",
      terminationStatus: "RUNNING",
      lastTerminationError: null
    }
  });

  await writeAudit(prisma, {
    action: "PROJECT_TERMINATE_START",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    userId: input.userId,
    description: `Encerramento do projeto ${project.name} iniciado.`,
    newData: {
      options,
      retryPendingOnly
    }
  });

  setStep(steps, "validate", "success", "Projeto validado para encerramento.");

  const settingsRows = await prisma.appSetting.findMany();
  const settings = settingsRows.length > 0 ? toSettings(settingsRows) : defaultSettings;
  const panelDomain = settings.defaultDomain || null;

  let dnsFailures = 0;
  let dnsSuccess = 0;
  let dnsSkipped = 0;

  if (options.deleteDnsRecords) {
    setStep(steps, "dns", "running");

    const records = project.records.filter((record) =>
      shouldProcessPending(retryPendingOnly, storedPending, "dns", record.id)
    );

    if (records.length === 0) {
      setStep(steps, "dns", "skipped", "Nenhum registro DNS pendente para exclusão.");
    } else {
      for (const record of records) {
        try {
          assertDnsRecordTerminationAllowed(record, record.domain.name, panelDomain);
        } catch (error) {
          dnsSkipped += 1;
          const message =
            error instanceof ProjectGuardError
              ? error.message
              : "Registro DNS protegido e preservado durante o encerramento.";

          await writeAudit(prisma, {
            action: "PROJECT_TERMINATE_DNS_DELETE_FAILED",
            entityType: "record",
            entityId: record.id,
            entityName: `${record.type} ${record.name}`,
            userId: input.userId,
            description: message
          });
          continue;
        }

        const result = await deleteProjectDnsRecord({
          recordId: record.id,
          userId: input.userId,
          auditSuccessAction: "PROJECT_TERMINATE_DNS_DELETE_SUCCESS",
          auditFailedAction: "PROJECT_TERMINATE_DNS_DELETE_FAILED"
        });

        if (result.outcome === "success") {
          dnsSuccess += 1;
        } else if (result.outcome === "skipped") {
          dnsSkipped += 1;
        } else {
          dnsFailures += 1;
          pending.push({
            type: "dns",
            id: record.id,
            label: `${record.type} ${record.name}`,
            error: result.message
          });
          await writeAudit(prisma, {
            action: "PROJECT_TERMINATE_DNS_DELETE_FAILED",
            entityType: "record",
            entityId: record.id,
            entityName: `${record.type} ${record.name}`,
            userId: input.userId,
            description: result.message
          });
        }
      }

      if (dnsFailures > 0) {
        setStep(
          steps,
          "dns",
          "error",
          `${dnsSuccess} removido(s), ${dnsFailures} falha(s)${dnsSkipped ? `, ${dnsSkipped} ignorado(s)` : ""}.`
        );
      } else {
        setStep(
          steps,
          "dns",
          dnsSuccess > 0 ? "success" : "skipped",
          dnsSuccess > 0 ? `${dnsSuccess} registro(s) DNS processado(s).` : "Nenhum registro DNS ativo para remover."
        );
      }
    }
  } else {
    setStep(steps, "dns", "skipped", "Exclusão de DNS não selecionada.");
  }

  let appFailures = 0;
  let appSuccess = 0;

  if (options.deleteCoolifyApplications) {
    setStep(steps, "coolify_apps", "running");

    const applications = project.applications.filter(
      (application) =>
        application.status !== "REMOVED_REMOTE" &&
        shouldProcessPending(retryPendingOnly, storedPending, "coolify_app", application.id)
    );

    if (applications.length === 0) {
      setStep(steps, "coolify_apps", "skipped", "Nenhuma aplicação pendente para remover.");
    } else {
      for (const application of applications) {
        try {
          assertApplicationTerminationAllowed(application);
        } catch (error) {
          const message = error instanceof ProjectGuardError ? error.message : "Aplicação protegida.";
          appFailures += 1;
          pending.push({
            type: "coolify_app",
            id: application.id,
            label: application.name,
            error: message
          });
          continue;
        }

        if (!application.coolifyApplicationId || !application.coolifyApplication) {
          await prisma.projectApplication.update({
            where: { id: application.id },
            data: {
              status: "ARCHIVED",
              archivedAt: new Date()
            }
          });
          appSuccess += 1;
          continue;
        }

        if (application.status === "REMOVED_REMOTE") {
          continue;
        }

        const coolifyUuid = application.coolifyApplication.coolifyId;

        try {
          await deleteCoolifyApplication(coolifyUuid);
          const now = new Date();

          await prisma.$transaction(async (tx) => {
            await tx.projectApplication.update({
              where: { id: application.id },
              data: {
                status: "REMOVED_REMOTE",
                destroyedAt: now,
                destroyedBy: input.userId,
                destroyStatus: "SUCCESS",
                lastDestroyError: null
              }
            });

            await tx.coolifyApplication.update({
              where: { id: application.coolifyApplication!.id },
              data: {
                status: "REMOVED",
                removedAt: now,
                isActive: false
              }
            });

            await writeAudit(tx, {
              action: "PROJECT_TERMINATE_COOLIFY_APP_DELETE_SUCCESS",
              entityType: "project_application",
              entityId: application.id,
              entityName: application.name,
              userId: input.userId,
              description: `Aplicação ${application.name} removida do Coolify.`,
              newData: {
                coolifyApplicationUuid: coolifyUuid,
                status: "REMOVED_REMOTE"
              }
            });
          });

          appSuccess += 1;
        } catch (error) {
          appFailures += 1;
          const message =
            error instanceof CoolifyApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Falha ao remover aplicação no Coolify.";

          await prisma.projectApplication.update({
            where: { id: application.id },
            data: {
              destroyStatus: "FAILED",
              lastDestroyError: message
            }
          });

          pending.push({
            type: "coolify_app",
            id: application.id,
            label: application.name,
            error: message
          });

          await writeAudit(prisma, {
            action: "PROJECT_TERMINATE_COOLIFY_APP_DELETE_FAILED",
            entityType: "project_application",
            entityId: application.id,
            entityName: application.name,
            userId: input.userId,
            description: message
          });
        }
      }

      if (appFailures > 0) {
        setStep(steps, "coolify_apps", "error", `${appSuccess} removida(s), ${appFailures} falha(s).`);
      } else {
        setStep(
          steps,
          "coolify_apps",
          appSuccess > 0 ? "success" : "skipped",
          appSuccess > 0 ? `${appSuccess} aplicação(ões) processada(s).` : "Nenhuma aplicação Coolify para remover."
        );
      }
    }
  } else {
    setStep(steps, "coolify_apps", "skipped", "Exclusão de aplicações Coolify não selecionada.");
  }

  const coolifyProjects = resolveProjectCoolifyProjects(project);

  if (options.deleteCoolifyProject && coolifyProjects.length > 0) {
    setStep(steps, "coolify_project", "running");

    let projectDeleteSuccess = 0;
    let projectDeleteFailures = 0;
    let projectDeleteSkipped = 0;

    for (const coolifyProject of coolifyProjects) {
      const shouldTryProject =
        shouldProcessPending(retryPendingOnly, storedPending, "coolify_project", coolifyProject.id) ||
        !retryPendingOnly;

      if (!shouldTryProject) {
        projectDeleteSkipped += 1;
        continue;
      }

      const remainingCoolifyApps = await prisma.projectApplication.count({
        where: {
          projectId: project.id,
          coolifyProjectId: coolifyProject.id,
          coolifyApplicationId: { not: null },
          status: { notIn: ["REMOVED_REMOTE", "ARCHIVED"] }
        }
      });

      if (remainingCoolifyApps > 0 && options.deleteCoolifyApplications) {
        const message = `O projeto Coolify "${coolifyProject.name}" ainda possui aplicações vinculadas.`;
        projectDeleteFailures += 1;
        pending.push({
          type: "coolify_project",
          id: coolifyProject.id,
          label: coolifyProject.name,
          error: message
        });
        await writeAudit(prisma, {
          action: "PROJECT_TERMINATE_COOLIFY_PROJECT_SKIPPED",
          entityType: "coolify",
          entityId: coolifyProject.id,
          entityName: coolifyProject.name,
          userId: input.userId,
          description: message
        });
        continue;
      }

      try {
        assertCoolifyProjectDeletionAllowed({
          coolifyProject,
          deleteCoolifyProject: true,
          confirmExternalRemoval: options.confirmExternalCoolifyRemoval
        });

        await deleteCoolifyProject(coolifyProject.coolifyId);
        const now = new Date();

        await prisma.$transaction(async (tx) => {
          await tx.coolifyProject.update({
            where: { id: coolifyProject.id },
            data: {
              status: "REMOVED",
              removedAt: now,
              isActive: false
            }
          });

          await tx.projectApplication.updateMany({
            where: {
              projectId: project.id,
              coolifyProjectId: coolifyProject.id
            },
            data: {
              coolifyProjectId: null
            }
          });

          if (project.coolifyLink?.coolifyProjectCacheId === coolifyProject.id) {
            await tx.projectCoolifyLink.update({
              where: { id: project.coolifyLink.id },
              data: {
                coolifyProjectCacheId: null
              }
            });
          }

          await writeAudit(tx, {
            action: "PROJECT_TERMINATE_COOLIFY_PROJECT_DELETE_SUCCESS",
            entityType: "coolify",
            entityId: coolifyProject.id,
            entityName: coolifyProject.name,
            userId: input.userId,
            description: `Projeto Coolify ${coolifyProject.name} removido.`
          });
        });

        projectDeleteSuccess += 1;
      } catch (error) {
        projectDeleteFailures += 1;
        const message =
          error instanceof ProjectGuardError
            ? error.message
            : error instanceof CoolifyApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Não foi possível excluir o projeto Coolify.";

        const friendlyMessage =
          "Aplicações removidas, mas não foi possível excluir o projeto Coolify. Remova manualmente no Coolify ou tente novamente.";

        pending.push({
          type: "coolify_project",
          id: coolifyProject.id,
          label: coolifyProject.name,
          error: message
        });

        await writeAudit(prisma, {
          action:
            error instanceof ProjectGuardError
              ? "PROJECT_TERMINATE_COOLIFY_PROJECT_SKIPPED"
              : "PROJECT_TERMINATE_COOLIFY_PROJECT_DELETE_FAILED",
          entityType: "coolify",
          entityId: coolifyProject.id,
          entityName: coolifyProject.name,
          userId: input.userId,
          description: message
        });

        if (!(error instanceof ProjectGuardError)) {
          setStep(steps, "coolify_project", "error", friendlyMessage);
        }
      }
    }

    if (projectDeleteFailures > 0) {
      setStep(
        steps,
        "coolify_project",
        "error",
        `${projectDeleteSuccess} removido(s), ${projectDeleteFailures} falha(s)${projectDeleteSkipped ? `, ${projectDeleteSkipped} ignorado(s)` : ""}.`
      );
    } else if (projectDeleteSuccess > 0) {
      setStep(steps, "coolify_project", "success", `${projectDeleteSuccess} projeto(s) Coolify removido(s).`);
    } else if (projectDeleteSkipped > 0) {
      setStep(steps, "coolify_project", "skipped", "Nenhum projeto Coolify pendente para remover.");
    } else {
      setStep(steps, "coolify_project", "skipped", "Nenhum projeto Coolify ativo para remover.");
    }
  } else if (coolifyProjects.length > 0 && !options.deleteCoolifyProject) {
    setStep(steps, "coolify_project", "skipped", "Exclusão do projeto Coolify não selecionada.");
    for (const coolifyProject of coolifyProjects) {
      await writeAudit(prisma, {
        action: "PROJECT_TERMINATE_COOLIFY_PROJECT_SKIPPED",
        entityType: "coolify",
        entityId: coolifyProject.id,
        entityName: coolifyProject.name,
        userId: input.userId,
        description: "Projeto Coolify preservado por opção do usuário."
      });
    }
  } else {
    setStep(steps, "coolify_project", "skipped", "Nenhum projeto Coolify vinculado.");
  }

  let dbFailures = 0;
  let dbSuccess = 0;

  if (options.destroyDatabases) {
    setStep(steps, "databases", "running");

    const databases = project.databases.filter((database) =>
      shouldProcessPending(retryPendingOnly, storedPending, "database", database.id)
    );

    if (databases.length === 0) {
      setStep(steps, "databases", "skipped", "Nenhum banco pendente para desprovisionar.");
    } else {
      for (const database of databases) {
        try {
          assertDatabaseTerminationAllowed(database);
          await destroyProjectDatabase(database.id, input.userId);
          dbSuccess += 1;
          await writeAudit(prisma, {
            action: "PROJECT_TERMINATE_DATABASE_DESTROY_SUCCESS",
            entityType: "project_database",
            entityId: database.id,
            entityName: database.name,
            userId: input.userId,
            description: `Banco ${database.name} desprovisionado durante encerramento.`
          });
        } catch (error) {
          dbFailures += 1;
          const message =
            error instanceof DatabaseGuardError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Falha ao desprovisionar banco.";

          pending.push({
            type: "database",
            id: database.id,
            label: database.name,
            error: message
          });

          await writeAudit(prisma, {
            action: "PROJECT_TERMINATE_DATABASE_DESTROY_FAILED",
            entityType: "project_database",
            entityId: database.id,
            entityName: database.name,
            userId: input.userId,
            description: message
          });
        }
      }

      if (dbFailures > 0) {
        setStep(steps, "databases", "error", `${dbSuccess} destruído(s), ${dbFailures} falha(s).`);
      } else {
        setStep(steps, "databases", dbSuccess > 0 ? "success" : "skipped", `${dbSuccess} banco(s) desprovisionado(s).`);
      }
    }
  } else {
    setStep(steps, "databases", "skipped", "Bancos PostgreSQL foram preservados.");
  }

  if (options.archiveProject) {
    setStep(steps, "archive", "running");

    try {
      const archivedAt = new Date();
      await prisma.project.update({
        where: { id: project.id },
        data: {
          archivedAt
        }
      });
      setStep(steps, "archive", "success", "Projeto arquivado no MiniHost.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao arquivar projeto.";
      setStep(steps, "archive", "error", message);
      pending.push({
        type: "database",
        id: project.id,
        label: project.name,
        error: message
      });
    }
  } else {
    setStep(steps, "archive", "skipped", "Arquivamento local não selecionado.");
  }

  setStep(steps, "sync", "running");

  try {
    await syncCoolifyResources();
    setStep(steps, "sync", "success", "Recursos Coolify sincronizados.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar Coolify.";
    setStep(steps, "sync", "error", message);
  }

  const partial = pending.length > 0;
  const now = new Date();
  const finalStatus = partial ? "TERMINATED_WITH_ERRORS" : "TERMINATED";
  const summaryMessage = partial
    ? "Encerramento concluído com pendências."
    : "Projeto encerrado com sucesso.";

  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: finalStatus,
      terminatedAt: now,
      terminatedBy: input.userId,
      terminationStatus: partial ? "PARTIAL" : "SUCCESS",
      lastTerminationError: partial ? summaryMessage : null,
      terminationPending: partial ? pending : Prisma.JsonNull
    }
  });

  setStep(steps, "finished", partial ? "error" : "success", summaryMessage);

  const updatedProject = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      _count: {
        select: {
          records: { where: { status: { not: "DELETED" } } },
          databases: { where: { status: { not: "ARCHIVED" } } },
          applications: { where: { status: { not: "ARCHIVED" } } }
        }
      },
      coolifyLink: {
        include: {
          coolifyProject: true,
          coolifyApplication: true
        }
      }
    }
  });

  await writeAudit(prisma, {
    action: partial ? "PROJECT_TERMINATE_PARTIAL" : "PROJECT_TERMINATE_SUCCESS",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    userId: input.userId,
    description: summaryMessage,
    newData: {
      status: finalStatus,
      pendingCount: pending.length,
      project: updatedProject ? toProject(updatedProject) : undefined
    }
  });

  return {
    success: !partial,
    partial,
    message: summaryMessage,
    projectId: project.id,
    projectStatus: finalStatus,
    steps,
    pending
  };
}

export async function getProjectTerminatePreview(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: projectInclude
  });

  if (!project) {
    throw new ProjectTerminatorError("Projeto não encontrado.");
  }

  const coolifyProjects = resolveProjectCoolifyProjects(project);

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status
    },
    confirmationText: `encerrar ${project.slug}`,
    defaults: {
      archiveProject: true,
      deleteDnsRecords: true,
      deleteCoolifyApplications: true,
      deleteCoolifyProject: coolifyProjects.some((item) => item.createdByMiniHost),
      destroyDatabases: false
    } satisfies TerminateOptions,
    resources: {
      dnsRecords: project.records.map((record) => ({
        id: record.id,
        name: record.name,
        type: record.type,
        status: record.status,
        cloudflareRecordId: record.cloudflareRecordId,
        domainName: record.domain.name
      })),
      applications: project.applications.map((application) => ({
        id: application.id,
        name: application.name,
        slug: application.slug,
        status: application.status,
        hasCoolify: Boolean(application.coolifyApplicationId),
        coolifyApplicationName: application.coolifyApplication?.name,
        coolifyProjectName: application.coolifyProject?.name
      })),
      coolifyProjects: coolifyProjects.map((coolifyProject) => ({
        id: coolifyProject.id,
        name: coolifyProject.name,
        status: coolifyProject.status,
        createdByMiniHost: coolifyProject.createdByMiniHost
      })),
      databases: project.databases.map((database) => ({
        id: database.id,
        name: database.name,
        databaseName: database.databaseName,
        databaseUser: database.databaseUser,
        status: database.status
      }))
    },
    pending: parseStoredPending(project.terminationPending)
  };
}
