import { createCoolifyProject, CoolifyApiError } from "@/lib/coolify";
import { isPublicGitRepository } from "@/lib/coolify-provision";
import { buildCoolifyApplicationUrl } from "@/lib/coolify-provision";
import { prisma } from "@/lib/prisma";
import {
  buildStaticPublishConfirmationText,
  slugifyPublishValue,
  type StaticPublishInput,
  type StaticPublishStepId,
  type StaticPublishStepResult,
  type StaticPublishStepStatus
} from "@/lib/publish";
import { writeAudit } from "@/lib/server/audit";
import { CloudflareDnsRecordError, createCloudflareDnsRecord } from "@/lib/server/cloudflare-dns-record";
import { hasCoolifyCredential } from "@/lib/server/coolify-credential";
import {
  CoolifyApplicationProvisionerError,
  provisionCoolifyApplication
} from "@/lib/server/coolify-application-provisioner";
import { syncProjectApplicationCoolifyStatus } from "@/lib/server/coolify-application-post-provision";
import { syncCoolifyResources } from "@/lib/server/coolify-cache";
import { buildRecordFqdn } from "@/lib/server/dns-records";
import { defaultSettings, toDnsRecord, toProject, toProjectApplication, toSettings } from "@/lib/server/mappers";
import {
  calculateApplicationReadiness,
  encryptEnvironmentVariables,
  isSensitiveEnvKey,
  normalizeProjectApplicationInput,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit,
  slugifyApplicationName
} from "@/lib/server/project-application";
import { validateDnsRecordBody, validateProjectInput } from "@/lib/server/validation";
import type { DnsRecordFormInput, DnsRecordType, MiniHostSettings, ProjectApplicationEnvVar } from "@/lib/types";

export class StaticPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaticPublishError";
  }
}

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

const STEP_LABELS: Record<StaticPublishStepId, string> = {
  project: "Criar projeto MiniHost",
  dns: "Criar/vincular DNS",
  application: "Criar aplicação planejada",
  coolify_project: "Criar projeto no Coolify",
  coolify_create: "Criar aplicação no Coolify",
  envs: "Aplicar variáveis no Coolify",
  deploy: "Iniciar deploy",
  sync: "Sincronizar status",
  finished: "Finalizado"
};

function createStep(id: StaticPublishStepId, status: StaticPublishStepStatus, message?: string): StaticPublishStepResult {
  return {
    id,
    label: STEP_LABELS[id],
    status,
    message
  };
}

function normalizeStaticPublishInput(body: Partial<StaticPublishInput>): StaticPublishInput {
  const environmentVariables = Array.isArray(body.application?.environmentVariables)
    ? body.application.environmentVariables
        .filter((item): item is ProjectApplicationEnvVar => Boolean(item?.key))
        .map((item) => ({
          key: String(item.key).trim(),
          value: String(item.value ?? "")
        }))
    : [];

  const projectSlug = slugifyPublishValue(String(body.project?.slug ?? body.project?.name ?? ""));
  const applicationSlug = slugifyApplicationName(String(body.application?.slug ?? body.application?.name ?? ""));

  return {
    confirmationText: String(body.confirmationText ?? "").trim(),
    project: {
      name: String(body.project?.name ?? "").trim(),
      slug: projectSlug,
      description: body.project?.description ? String(body.project.description).trim() : undefined
    },
    dns: {
      mode: body.dns?.mode === "existing" || body.dns?.mode === "skip" ? body.dns.mode : "create",
      fqdn: body.dns?.fqdn ? String(body.dns.fqdn).trim().toLowerCase() : undefined,
      domainId: body.dns?.domainId ? String(body.dns.domainId) : undefined,
      type: (body.dns?.type ?? "A") as DnsRecordType,
      name: body.dns?.name !== undefined ? String(body.dns.name) : "@",
      value: body.dns?.value ? String(body.dns.value).trim() : undefined,
      proxied: Boolean(body.dns?.proxied),
      ttl: body.dns?.ttl === "auto" || body.dns?.ttl === undefined ? "auto" : Number(body.dns.ttl),
      recordId: body.dns?.recordId ? String(body.dns.recordId) : undefined
    },
    application: {
      name: String(body.application?.name ?? "").trim(),
      slug: applicationSlug,
      gitRepository: String(body.application?.gitRepository ?? "").trim(),
      gitBranch: String(body.application?.gitBranch ?? "main").trim(),
      installCommand: String(body.application?.installCommand ?? "npm install").trim(),
      buildCommand: String(body.application?.buildCommand ?? "npm run build").trim(),
      outputDirectory: String(body.application?.outputDirectory ?? "/dist").trim(),
      environmentVariables
    },
    coolify: {
      createApplication: body.coolify?.createApplication !== false,
      serverId: body.coolify?.serverId ? String(body.coolify.serverId) : undefined,
      projectMode:
        body.coolify?.projectMode === "existing" ? "existing" : ("create" as const),
      projectId: body.coolify?.projectId ? String(body.coolify.projectId) : undefined,
      projectName: body.coolify?.projectName
        ? String(body.coolify.projectName).trim()
        : String(body.project?.name ?? "").trim() || undefined,
      projectDescription: body.coolify?.projectDescription
        ? String(body.coolify.projectDescription).trim()
        : body.project?.description
          ? String(body.project.description).trim()
          : undefined,
      applyEnvsAfterCreate:
        body.coolify?.applyEnvsAfterCreate !== undefined
          ? Boolean(body.coolify.applyEnvsAfterCreate)
          : environmentVariables.length > 0,
      deployAfterCreate: body.coolify?.deployAfterCreate !== false,
      syncAfterDeploy: body.coolify?.syncAfterDeploy !== false
    }
  };
}

function validateStaticPublishInput(input: StaticPublishInput) {
  const errors: string[] = [];

  const projectValidation = validateProjectInput({
    name: input.project.name,
    slug: input.project.slug,
    description: input.project.description ?? "",
    status: "ACTIVE",
    mainDomain: input.dns.fqdn ?? ""
  });

  errors.push(...projectValidation.errors);

  if (!input.application.name) {
    errors.push("Informe o nome da aplicação.");
  }

  if (!input.application.slug) {
    errors.push("Informe o slug da aplicação.");
  }

  if (!input.application.gitRepository) {
    errors.push("Informe o repositório Git público.");
  } else if (!isPublicGitRepository(input.application.gitRepository)) {
    errors.push("Somente repositórios públicos via HTTPS são suportados.");
  }

  if (!input.application.gitBranch) {
    errors.push("Informe a branch Git.");
  }

  if (!input.application.buildCommand) {
    errors.push("Informe o build command.");
  }

  if (!input.application.outputDirectory) {
    errors.push("Informe o output directory.");
  }

  if (input.dns.mode === "create") {
    if (!input.dns.domainId) {
      errors.push("Selecione o domínio/zona Cloudflare.");
    }

    if (!input.dns.value?.trim()) {
      errors.push("Informe o valor do registro DNS.");
    }
  }

  if (input.dns.mode === "existing" && !input.dns.recordId) {
    errors.push("Selecione um registro DNS existente.");
  }

  if (input.dns.mode !== "skip" && !input.dns.fqdn?.trim()) {
    errors.push("Informe o domínio final (FQDN) da aplicação.");
  }

  if (input.coolify.createApplication) {
    if (!input.coolify.serverId) {
      errors.push("Selecione o servidor Coolify.");
    }

    if (input.coolify.projectMode === "existing" && !input.coolify.projectId) {
      errors.push("Selecione o projeto Coolify.");
    }

    if (input.coolify.projectMode === "create" && !input.coolify.projectName?.trim()) {
      errors.push("Informe o nome do projeto Coolify.");
    }
  }

  return errors;
}

async function loadSettings(): Promise<MiniHostSettings> {
  const rows = await prisma.appSetting.findMany();
  return rows.length > 0 ? toSettings(rows) : defaultSettings;
}

async function resolveCoolifyProjectCacheId(input: {
  projectMode: "create" | "existing";
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  minihostProjectName: string;
  minihostProjectDescription?: string;
  userId: string;
}) {
  if (input.projectMode === "existing") {
    const cached = await prisma.coolifyProject.findUnique({
      where: { id: input.projectId }
    });

    if (!cached || cached.status !== "ACTIVE") {
      throw new StaticPublishError("Projeto Coolify selecionado está ausente ou inativo. Sincronize novamente.");
    }

    return cached.id;
  }

  const projectName = input.projectName?.trim() || input.minihostProjectName;
  const projectDescription = input.projectDescription?.trim() || input.minihostProjectDescription;

  let created;

  try {
    created = await createCoolifyProject({
      name: projectName,
      description: projectDescription
    });
  } catch (error) {
    const message =
      error instanceof CoolifyApiError
        ? error.message
        : "Não foi possível criar o projeto no Coolify.";

    throw new StaticPublishError(message);
  }

  await syncCoolifyResources();

  const cached = await prisma.coolifyProject.findUnique({
    where: { coolifyId: created.uuid }
  });

  if (cached) {
    await writeAudit(prisma, {
      action: "STATIC_PUBLISH_COOlify_PROJECT_CREATED",
      entityType: "coolify",
      entityId: cached.id,
      entityName: cached.name,
      userId: input.userId,
      description: `Projeto ${cached.name} criado no Coolify durante publicação Static.`,
      newData: {
        coolifyProjectId: created.uuid,
        name: cached.name
      }
    });

    return cached.id;
  }

  const now = new Date();
  const fallback = await prisma.coolifyProject.create({
    data: {
      coolifyId: created.uuid,
      name: created.name,
      description: projectDescription ?? null,
      status: "ACTIVE",
      lastSeenAt: now,
      lastSyncedAt: now,
      rawData: {
        uuid: created.uuid,
        name: created.name,
        source: "minihost-publish"
      }
    }
  });

  await writeAudit(prisma, {
    action: "STATIC_PUBLISH_COOlify_PROJECT_CREATED",
    entityType: "coolify",
    entityId: fallback.id,
    entityName: fallback.name,
    userId: input.userId,
    description: `Projeto ${fallback.name} criado no Coolify durante publicação Static.`,
    newData: {
      coolifyProjectId: created.uuid,
      name: fallback.name
    }
  });

  return fallback.id;
}

async function linkExistingDnsRecord(projectId: string, recordId: string, userId: string) {
  const record = await prisma.dnsRecord.findFirst({
    where: {
      id: recordId,
      status: { not: "DELETED" }
    },
    include: {
      domain: true,
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!record) {
    throw new StaticPublishError("Registro DNS não encontrado.");
  }

  if (record.projectId && record.projectId !== projectId) {
    throw new StaticPublishError("Este registro DNS já está vinculado a outro projeto.");
  }

  if (record.projectId === projectId) {
    return {
      record: toDnsRecord(record),
      fqdn: buildRecordFqdn(record.name, record.domain.name)
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.dnsRecord.update({
      where: { id: record.id },
      data: { projectId },
      include: {
        domain: true,
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await writeAudit(tx, {
      action: "STATIC_PUBLISH_DNS_LINKED",
      entityType: "record",
      entityId: saved.id,
      entityName: `${saved.type} ${saved.name}`,
      userId,
      description: `Registro DNS vinculado ao projeto durante publicação Static.`,
      newData: {
        projectId,
        recordId: saved.id,
        fqdn: buildRecordFqdn(saved.name, saved.domain.name)
      }
    });

    return saved;
  });

  return {
    record: toDnsRecord(updated),
    fqdn: buildRecordFqdn(updated.name, updated.domain.name)
  };
}

export type StaticPublishResult = {
  success: boolean;
  message: string;
  steps: StaticPublishStepResult[];
  project?: ReturnType<typeof toProject>;
  dnsRecord?: ReturnType<typeof toDnsRecord>;
  application?: ReturnType<typeof toProjectApplication>;
  coolifyBaseUrl?: string;
  siteUrl?: string;
  coolifyUrl?: string;
  failedStepId?: StaticPublishStepId;
  nextActions?: string[];
};

export async function publishStaticApplication(input: StaticPublishInput, userId: string): Promise<StaticPublishResult> {
  const normalized = normalizeStaticPublishInput(input);
  const validationErrors = validateStaticPublishInput(normalized);

  if (validationErrors.length > 0) {
    throw new StaticPublishError(validationErrors[0]);
  }

  const expectedConfirmation = buildStaticPublishConfirmationText(normalized.project.slug);

  if (normalized.confirmationText !== expectedConfirmation) {
    throw new StaticPublishError(`Digite exatamente: ${expectedConfirmation}`);
  }

  const duplicateProject = await prisma.project.findUnique({
    where: { slug: normalized.project.slug }
  });

  if (duplicateProject) {
    throw new StaticPublishError("Já existe um projeto com esse slug. Escolha outro slug ou use o modo avançado.");
  }

  if (normalized.coolify.createApplication && !(await hasCoolifyCredential())) {
    throw new StaticPublishError("Configure a credencial do Coolify em Configurações.");
  }

  const steps: StaticPublishStepResult[] = [
    createStep("project", "pending"),
    createStep("dns", normalized.dns.mode === "skip" ? "pending" : "pending"),
    createStep("application", "pending"),
    createStep("coolify_project", normalized.coolify.createApplication ? "pending" : "pending"),
    createStep("coolify_create", normalized.coolify.createApplication ? "pending" : "pending"),
    createStep("envs", "pending"),
    createStep("deploy", "pending"),
    createStep("sync", "pending"),
    createStep("finished", "pending")
  ];

  function setStep(id: StaticPublishStepId, status: StaticPublishStepStatus, message?: string) {
    const index = steps.findIndex((step) => step.id === id);

    if (index >= 0) {
      steps[index] = createStep(id, status, message);
    }
  }

  let projectId: string | undefined;
  let projectSlug: string | undefined;
  let dnsRecordId: string | undefined;
  let applicationDomain = normalized.dns.fqdn?.trim().toLowerCase() ?? "";
  let applicationId: string | undefined;
  let coolifyBaseUrl: string | undefined;

  const credential = normalized.coolify.createApplication
    ? await prisma.coolifyCredential.findFirst({ where: { status: "ACTIVE" } })
    : null;
  coolifyBaseUrl = credential?.baseUrl;

  await writeAudit(prisma, {
    action: "STATIC_PUBLISH_START",
    entityType: "project",
    entityName: normalized.project.name,
    userId,
    description: `Iniciando publicação Static do projeto ${normalized.project.name}.`,
    newData: {
      projectSlug: normalized.project.slug,
      applicationSlug: normalized.application.slug,
      dnsMode: normalized.dns.mode,
      fqdn: applicationDomain || undefined,
      coolify: {
        createApplication: normalized.coolify.createApplication,
        deployAfterCreate: normalized.coolify.deployAfterCreate
      },
      environmentVariables: sanitizeEnvVariablesForAudit(normalized.application.environmentVariables ?? [])
    }
  });

  try {
    setStep("project", "running");

    const projectValidation = validateProjectInput({
      name: normalized.project.name,
      slug: normalized.project.slug,
      description: normalized.project.description ?? "",
      status: "ACTIVE",
      mainDomain: applicationDomain || ""
    });

    const createdProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...projectValidation.data,
          mainDomain: applicationDomain || projectValidation.data.mainDomain
        },
        include: {
          _count: {
            select: {
              records: { where: { status: { not: "DELETED" } } },
              databases: { where: { status: { not: "ARCHIVED" } } },
              applications: { where: { status: { not: "ARCHIVED" } } }
            }
          }
        }
      });

      await writeAudit(tx, {
        action: "STATIC_PUBLISH_PROJECT_CREATED",
        entityType: "project",
        entityId: project.id,
        entityName: project.name,
        userId,
        description: `Projeto ${project.name} criado pela publicação Static.`,
        newData: toProject(project)
      });

      return project;
    });

    projectId = createdProject.id;
    projectSlug = createdProject.slug;
    setStep("project", "success", `Projeto ${createdProject.name} criado.`);

    if (normalized.dns.mode === "skip") {
      setStep("dns", "skipped", "DNS não configurado nesta publicação.");
    } else {
      setStep("dns", "running");

      if (normalized.dns.mode === "create") {
        const settings = await loadSettings();
        const dnsBody: DnsRecordFormInput = {
          domainId: normalized.dns.domainId!,
          type: normalized.dns.type ?? "A",
          name: normalized.dns.name ?? "@",
          value: normalized.dns.value ?? settings.defaultVpsIp,
          ttl: normalized.dns.ttl ?? "auto",
          proxied: normalized.dns.proxied ?? settings.defaultProxyEnabled,
          status: "active",
          projectId: createdProject.id
        };
        const { data, errors } = validateDnsRecordBody(dnsBody);

        if (errors.length > 0) {
          throw new StaticPublishError(errors[0]);
        }

        const dnsResult = await createCloudflareDnsRecord({
          userId,
          domainId: data.domainId,
          data,
          auditAction: "STATIC_PUBLISH_DNS_CREATED",
          auditDescription: `Registro DNS criado durante publicação Static do projeto ${createdProject.name}.`
        });

        dnsRecordId = dnsResult.record.id;
        applicationDomain = normalized.dns.fqdn?.trim().toLowerCase() || buildRecordFqdn(dnsResult.record.name, dnsResult.domainName);
        setStep("dns", "success", `Registro DNS criado (${dnsResult.record.type} ${dnsResult.record.name}).`);
      } else {
        const linked = await linkExistingDnsRecord(createdProject.id, normalized.dns.recordId!, userId);
        dnsRecordId = linked.record.id;
        applicationDomain = normalized.dns.fqdn?.trim().toLowerCase() || linked.fqdn;
        setStep("dns", "success", `Registro DNS vinculado (${linked.record.type} ${linked.record.name}).`);
      }

      if (applicationDomain) {
        await prisma.project.update({
          where: { id: createdProject.id },
          data: { mainDomain: applicationDomain }
        });
      }
    }

    setStep("application", "running");

    const applicationInput = normalizeProjectApplicationInput({
      name: normalized.application.name,
      slug: normalized.application.slug,
      type: "STATIC",
      gitRepository: normalized.application.gitRepository,
      gitBranch: normalized.application.gitBranch,
      installCommand: normalized.application.installCommand,
      buildCommand: normalized.application.buildCommand,
      outputDirectory: normalized.application.outputDirectory,
      startCommand: "",
      port: null,
      domain: applicationDomain || undefined,
      projectDatabaseId: null,
      dnsRecordId: dnsRecordId ?? null,
      environmentVariables: normalized.application.environmentVariables
    });

    const readiness = calculateApplicationReadiness(
      {
        name: applicationInput.name,
        slug: applicationInput.slug,
        type: "STATIC",
        gitRepository: applicationInput.gitRepository,
        gitBranch: applicationInput.gitBranch,
        domain: applicationInput.domain,
        port: applicationInput.port,
        buildCommand: applicationInput.buildCommand,
        startCommand: applicationInput.startCommand,
        outputDirectory: applicationInput.outputDirectory,
        projectDatabaseId: null,
        coolifyApplicationId: null
      },
      applicationInput.environmentVariables
    );

    if (!readiness.ready) {
      throw new StaticPublishError(readiness.issues[0] ?? "Aplicação Static não está pronta.");
    }

    const createdApplication = await prisma.$transaction(async (tx) => {
      const application = await tx.projectApplication.create({
        data: {
          projectId: createdProject.id,
          dnsRecordId: dnsRecordId ?? null,
          name: applicationInput.name,
          slug: applicationInput.slug,
          type: "STATIC",
          status: "READY",
          gitRepository: applicationInput.gitRepository,
          gitBranch: applicationInput.gitBranch,
          installCommand: applicationInput.installCommand,
          buildCommand: applicationInput.buildCommand,
          outputDirectory: applicationInput.outputDirectory,
          domain: applicationInput.domain,
          environmentVariablesEncrypted: encryptEnvironmentVariables(applicationInput.environmentVariables)
        },
        include: applicationInclude
      });

      await writeAudit(tx, {
        action: "STATIC_PUBLISH_APPLICATION_CREATED",
        entityType: "project_application",
        entityId: application.id,
        entityName: application.name,
        userId,
        description: `Aplicação Static ${application.name} criada durante publicação.`,
        newData: sanitizeProjectApplicationForAudit(application)
      });

      return application;
    });

    applicationId = createdApplication.id;
    setStep("application", "success", `Aplicação ${createdApplication.name} planejada.`);

    let finalApplication = createdApplication;

    if (!normalized.coolify.createApplication) {
      setStep("coolify_project", "skipped", "Criação no Coolify não solicitada.");
      setStep("coolify_create", "skipped", "Criação no Coolify não solicitada.");
      setStep("envs", "skipped", "Sem criação no Coolify.");
      setStep("deploy", "skipped", "Sem criação no Coolify.");
      setStep("sync", "skipped", "Sem criação no Coolify.");
      setStep("finished", "success", "Publicação concluída sem deploy no Coolify.");
    } else {
      setStep("coolify_project", "running");

      const coolifyProjectCacheId = await resolveCoolifyProjectCacheId({
        projectMode: normalized.coolify.projectMode ?? "create",
        projectId: normalized.coolify.projectId,
        projectName: normalized.coolify.projectName,
        projectDescription: normalized.coolify.projectDescription,
        minihostProjectName: createdProject.name,
        minihostProjectDescription: createdProject.description ?? undefined,
        userId
      });

      const coolifyProject = await prisma.coolifyProject.findUnique({
        where: { id: coolifyProjectCacheId }
      });

      setStep(
        "coolify_project",
        "success",
        normalized.coolify.projectMode === "existing"
          ? `Projeto Coolify ${coolifyProject?.name ?? "selecionado"} vinculado.`
          : `Projeto Coolify ${coolifyProject?.name ?? normalized.coolify.projectName} criado.`
      );

      setStep("coolify_create", "running");

      const provisionResult = await provisionCoolifyApplication({
        projectApplicationId: createdApplication.id,
        coolifyServerId: normalized.coolify.serverId!,
        coolifyProjectId: coolifyProjectCacheId,
        userId,
        applyEnvsAfterCreate: false,
        deployAfterCreate: false
      });

      finalApplication = provisionResult.application;

      await writeAudit(prisma, {
        action: "STATIC_PUBLISH_COOlify_CREATED",
        entityType: "project_application",
        entityId: finalApplication.id,
        entityName: finalApplication.name,
        userId,
        description: "Aplicação criada no Coolify durante publicação Static."
      });

      setStep("coolify_create", "success", "Aplicação criada no Coolify.");

      const hasEnvs = applicationInput.environmentVariables.length > 0;

      if (!hasEnvs || !normalized.coolify.applyEnvsAfterCreate) {
        setStep(
          "envs",
          "skipped",
          hasEnvs ? "Aplicação de variáveis não solicitada." : "Ignorado — sem variáveis."
        );
      } else {
        setStep("envs", "running");

        const { applyEnvsToCoolifyApplication } = await import("@/lib/server/coolify-application-post-provision");
        const envResult = await applyEnvsToCoolifyApplication({
          projectApplicationId: finalApplication.id,
          userId
        });
        finalApplication = envResult.application;

        await writeAudit(prisma, {
          action: "STATIC_PUBLISH_ENVS_APPLIED",
          entityType: "project_application",
          entityId: finalApplication.id,
          entityName: finalApplication.name,
          userId,
          description: "Variáveis aplicadas no Coolify durante publicação Static.",
          newData: {
            appliedCount: applicationInput.environmentVariables.length,
            environmentVariables: sanitizeEnvVariablesForAudit(applicationInput.environmentVariables)
          }
        });

        setStep("envs", "success", envResult.message);
      }

      if (!normalized.coolify.deployAfterCreate) {
        setStep("deploy", "skipped", "Deploy não solicitado.");
        setStep("sync", "skipped", "Sincronização não solicitada.");
      } else {
        setStep("deploy", "running");

        const { deployCoolifyApplication } = await import("@/lib/server/coolify-application-post-provision");
        const deployResult = await deployCoolifyApplication({
          projectApplicationId: finalApplication.id,
          userId
        });
        finalApplication = deployResult.application;

        await writeAudit(prisma, {
          action: "STATIC_PUBLISH_DEPLOY_STARTED",
          entityType: "project_application",
          entityId: finalApplication.id,
          entityName: finalApplication.name,
          userId,
          description: "Deploy iniciado durante publicação Static."
        });

        setStep("deploy", "success", deployResult.message);

        if (normalized.coolify.syncAfterDeploy) {
          setStep("sync", "running");
          finalApplication =
            (await syncProjectApplicationCoolifyStatus(finalApplication.id)) ?? finalApplication;

          await writeAudit(prisma, {
            action: "STATIC_PUBLISH_SYNC_COMPLETED",
            entityType: "project_application",
            entityId: finalApplication.id,
            entityName: finalApplication.name,
            userId,
            description: "Status sincronizado após publicação Static."
          });

          setStep("sync", "success", "Status sincronizado com o Coolify.");
        } else {
          setStep("sync", "skipped", "Sincronização não solicitada.");
        }
      }

      setStep("finished", "success", "Publicação iniciada com sucesso.");
    }

    const mappedProject = toProject(
      await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        include: {
          _count: {
            select: {
              records: { where: { status: { not: "DELETED" } } },
              databases: { where: { status: { not: "ARCHIVED" } } },
              applications: { where: { status: { not: "ARCHIVED" } } }
            }
          }
        }
      })
    );

    const mappedApplication = toProjectApplication(finalApplication, { includeEnvironmentValues: false });
    const mappedDns = dnsRecordId
      ? toDnsRecord(
          await prisma.dnsRecord.findUniqueOrThrow({
            where: { id: dnsRecordId },
            include: {
              project: { select: { id: true, name: true } }
            }
          })
        )
      : undefined;

    const coolifyUrl =
      coolifyBaseUrl &&
      mappedApplication.coolifyApplication?.coolifyId &&
      mappedApplication.coolifyProject?.coolifyId
        ? buildCoolifyApplicationUrl(
            coolifyBaseUrl,
            mappedApplication.coolifyProject.coolifyId,
            mappedApplication.coolifyApplication.coolifyId
          )
        : undefined;

    const siteUrl = applicationDomain ? `https://${applicationDomain.replace(/^https?:\/\//, "")}` : undefined;

    await writeAudit(prisma, {
      action: "STATIC_PUBLISH_SUCCESS",
      entityType: "project",
      entityId: projectId,
      entityName: mappedProject.name,
      userId,
      description: "Publicação Static concluída com sucesso.",
      newData: {
        projectId,
        applicationId,
        dnsRecordId,
        siteUrl,
        applicationStatus: mappedApplication.status
      }
    });

    return {
      success: true,
      message: "Publicação iniciada com sucesso.",
      steps,
      project: mappedProject,
      dnsRecord: mappedDns,
      application: mappedApplication,
      coolifyBaseUrl,
      siteUrl,
      coolifyUrl,
      nextActions: [
        "Abra o projeto para revisar detalhes.",
        siteUrl ? "Aguarde o deploy e acesse o domínio configurado." : "Configure o DNS se ainda não fez.",
        coolifyUrl ? "Acompanhe o build no Coolify." : undefined
      ].filter((item): item is string => Boolean(item))
    };
  } catch (error) {
    const message =
      error instanceof CoolifyApplicationProvisionerError ||
      error instanceof CloudflareDnsRecordError ||
      error instanceof StaticPublishError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Não foi possível concluir a publicação Static.";

    const failedStepId =
      steps.find((step) => step.status === "running")?.id ??
      steps.find((step) => step.status === "pending")?.id ??
      "finished";

    if (steps.find((step) => step.id === failedStepId)?.status === "running") {
      setStep(failedStepId, "error", message);
    } else {
      setStep(failedStepId, "error", message);
    }

    setStep("finished", "error", "Publicação interrompida.");

    await writeAudit(prisma, {
      action: "STATIC_PUBLISH_FAILED",
      entityType: "project",
      entityId: projectId,
      entityName: normalized.project.name,
      userId,
      description: message,
      newData: {
        failedStepId,
        projectId,
        applicationId,
        dnsRecordId
      }
    });

    const partialProjectRecord = projectId
      ? await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            _count: {
              select: {
                records: { where: { status: { not: "DELETED" } } },
                databases: { where: { status: { not: "ARCHIVED" } } },
                applications: { where: { status: { not: "ARCHIVED" } } }
              }
            }
          }
        })
      : null;

    const partialApplicationRecord = applicationId
      ? await prisma.projectApplication.findUnique({
          where: { id: applicationId },
          include: applicationInclude
        })
      : null;

    const partialDnsRecord = dnsRecordId
      ? await prisma.dnsRecord.findUnique({
          where: { id: dnsRecordId },
          include: { project: { select: { id: true, name: true } } }
        })
      : null;

    return {
      success: false,
      message,
      steps,
      project: partialProjectRecord ? toProject(partialProjectRecord) : undefined,
      application: partialApplicationRecord
        ? toProjectApplication(partialApplicationRecord, { includeEnvironmentValues: false })
        : undefined,
      dnsRecord: partialDnsRecord ? toDnsRecord(partialDnsRecord) : undefined,
      coolifyBaseUrl,
      failedStepId,
      nextActions: [
        projectId ? "Abra o projeto criado e continue manualmente na seção Aplicações." : "Corrija os dados e tente novamente.",
        applicationId ? "Revise a aplicação planejada nos detalhes do projeto." : undefined,
        "Use o modo avançado em Projetos, Registros DNS e Coolify se precisar ajustar etapas individuais."
      ].filter((item): item is string => Boolean(item))
    };
  }
}

export { isSensitiveEnvKey };
