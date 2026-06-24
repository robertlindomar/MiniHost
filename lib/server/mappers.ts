import type {
  AppSetting,
  AuditLog,
  CoolifyApplication as PrismaCoolifyApplication,
  CoolifyProject as PrismaCoolifyProject,
  CoolifyServer as PrismaCoolifyServer,
  DnsRecord as PrismaDnsRecord,
  Domain as PrismaDomain,
  ProjectApplication as PrismaProjectApplication,
  Project as PrismaProject,
  ProjectCoolifyLink as PrismaProjectCoolifyLink,
  ProjectDatabase as PrismaProjectDatabase
} from "@prisma/client";
import type {
  CoolifyApplicationCache,
  CoolifyCacheStatus,
  CoolifyProjectCache,
  CoolifyServerCache,
  DnsRecord,
  DnsRecordStatus,
  Domain,
  HistoryItem,
  MiniHostSettings,
  Project,
  ProjectApplication,
  ProjectApplicationStatus,
  ProjectApplicationType,
  ProjectDatabase,
  ProjectDatabaseStatus,
  ProjectStatus,
  TerminationPendingItem
} from "@/lib/types";
import {
  calculateApplicationReadiness,
  decryptEnvironmentVariables
} from "@/lib/server/project-application";

type DnsRecordWithProject = PrismaDnsRecord & {
  project?: {
    id: string;
    name: string;
  } | null;
};

type ProjectApplicationWithResources = PrismaProjectApplication & {
  projectDatabase?: PrismaProjectDatabase | null;
  dnsRecord?: DnsRecordWithProject | null;
  coolifyServer?: PrismaCoolifyServer | null;
  coolifyProject?: PrismaCoolifyProject | null;
  coolifyApplication?: PrismaCoolifyApplication | null;
};

type ProjectWithCount = PrismaProject & {
  _count?: {
    records: number;
    databases?: number;
    applications?: number;
  };
  coolifyLink?: ProjectCoolifyLinkWithResources | null;
};

type ProjectCoolifyLinkWithResources = PrismaProjectCoolifyLink & {
  coolifyProject?: PrismaCoolifyProject | null;
};

type AuditLogWithUser = AuditLog & {
  user?: {
    name: string;
    email: string;
  } | null;
};

export const defaultSettings: MiniHostSettings = {
  defaultZoneId: "",
  defaultDomain: "",
  defaultVpsIp: "",
  defaultProxyEnabled: true,
  defaultPostgresHost: "",
  defaultPostgresPort: "5432",
  defaultPostgresDatabaseSuffix: "_db",
  defaultPostgresUserSuffix: "_user"
};

function parseTerminationPending(value: unknown): TerminationPendingItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .filter((item): item is TerminationPendingItem => {
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
    })
    .map((item) => ({
      type: item.type,
      id: item.id,
      label: item.label,
      error: item.error
    }));

  return items.length > 0 ? items : undefined;
}

export function toProjectStatus(status: string): ProjectStatus {
  if (
    status === "ACTIVE" ||
    status === "PAUSED" ||
    status === "ARCHIVED" ||
    status === "TERMINATING" ||
    status === "TERMINATED" ||
    status === "TERMINATED_WITH_ERRORS"
  ) {
    return status;
  }

  return "DRAFT";
}

export function toProject(project: ProjectWithCount): Project {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description ?? undefined,
    status: toProjectStatus(project.status),
    mainDomain: project.mainDomain ?? undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    archivedAt: project.archivedAt?.toISOString(),
    terminatedAt: project.terminatedAt?.toISOString(),
    terminatedBy: project.terminatedBy ?? undefined,
    terminationStatus: project.terminationStatus ?? undefined,
    lastTerminationError: project.lastTerminationError ?? undefined,
    terminationPending: parseTerminationPending(project.terminationPending),
    recordCount: project._count?.records,
    databaseCount: project._count?.databases,
    applicationCount: project._count?.applications,
    coolifyLink: project.coolifyLink ? toProjectCoolifyLink(project.coolifyLink) : undefined
  };
}

export function toProjectApplicationStatus(status: string): ProjectApplicationStatus {
  if (
    status === "READY" ||
    status === "LINKED" ||
    status === "ENVS_APPLIED" ||
    status === "DEPLOYING" ||
    status === "DEPLOYED" ||
    status === "FAILED" ||
    status === "ARCHIVED" ||
    status === "REMOVED_REMOTE"
  ) {
    return status;
  }

  return "DRAFT";
}

export function toProjectApplicationType(type: string): ProjectApplicationType {
  if (
    type === "FRONTEND" ||
    type === "BACKEND" ||
    type === "FULLSTACK" ||
    type === "STATIC" ||
    type === "DOCKERFILE" ||
    type === "DOCKER_COMPOSE" ||
    type === "OTHER"
  ) {
    return type;
  }

  return "OTHER";
}

function toCoolifyCacheStatus(status: string): CoolifyCacheStatus {
  if (status === "MISSING" || status === "REMOVED" || status === "ERROR") {
    return status;
  }

  return "ACTIVE";
}

export function toProjectApplication(
  application: ProjectApplicationWithResources,
  options: { includeEnvironmentValues?: boolean } = {}
): ProjectApplication {
  const environmentVariables = decryptEnvironmentVariables(application.environmentVariablesEncrypted);
  const base = {
    id: application.id,
    projectId: application.projectId,
    projectDatabaseId: application.projectDatabaseId ?? undefined,
    dnsRecordId: application.dnsRecordId ?? undefined,
    name: application.name,
    slug: application.slug,
    type: toProjectApplicationType(application.type),
    status: toProjectApplicationStatus(application.status),
    gitRepository: application.gitRepository ?? undefined,
    gitBranch: application.gitBranch ?? undefined,
    rootDirectory: application.rootDirectory ?? undefined,
    buildCommand: application.buildCommand ?? undefined,
    startCommand: application.startCommand ?? undefined,
    installCommand: application.installCommand ?? undefined,
    outputDirectory: application.outputDirectory ?? undefined,
    port: application.port ?? undefined,
    domain: application.domain ?? undefined,
    notes: application.notes ?? undefined,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    archivedAt: application.archivedAt?.toISOString(),
    environmentVariableKeys: environmentVariables.map((variable) => variable.key),
    readiness: calculateApplicationReadiness(application, environmentVariables),
    projectDatabase: application.projectDatabase ? toProjectDatabase(application.projectDatabase) : undefined,
    dnsRecord: application.dnsRecord ? toDnsRecord(application.dnsRecord) : undefined,
    coolifyServer: application.coolifyServer ? toCoolifyServer(application.coolifyServer) : undefined,
    coolifyProject: application.coolifyProject ? toCoolifyProject(application.coolifyProject) : undefined,
    coolifyApplication: application.coolifyApplication ? toCoolifyApplication(application.coolifyApplication) : undefined,
    provisionedAt: application.provisionedAt?.toISOString(),
    provisionedBy: application.provisionedBy ?? undefined,
    lastProvisionStatus: application.lastProvisionStatus ?? undefined,
    lastProvisionMessage: application.lastProvisionMessage ?? undefined,
    envsAppliedAt: application.envsAppliedAt?.toISOString(),
    lastEnvsApplyStatus: application.lastEnvsApplyStatus ?? undefined,
    lastEnvsApplyMessage: application.lastEnvsApplyMessage ?? undefined,
    lastDeployStartedAt: application.lastDeployStartedAt?.toISOString(),
    lastDeployStatus: application.lastDeployStatus ?? undefined,
    lastDeployMessage: application.lastDeployMessage ?? undefined,
    lastCoolifySyncAt: application.lastCoolifySyncAt?.toISOString(),
    destroyedAt: application.destroyedAt?.toISOString(),
    destroyedBy: application.destroyedBy ?? undefined,
    destroyStatus: application.destroyStatus ?? undefined,
    lastDestroyError: application.lastDestroyError ?? undefined
  };

  return options.includeEnvironmentValues
    ? { ...base, environmentVariables }
    : base;
}

export function toCoolifyServer(server: PrismaCoolifyServer): CoolifyServerCache {
  return {
    id: server.id,
    coolifyId: server.coolifyId,
    name: server.name,
    description: server.description ?? undefined,
    status: toCoolifyCacheStatus(server.status),
    remoteStatus: server.remoteStatus ?? undefined,
    ip: server.ip ?? undefined,
    isActive: server.isActive,
    lastSeenAt: server.lastSeenAt?.toISOString(),
    missingSince: server.missingSince?.toISOString(),
    removedAt: server.removedAt?.toISOString(),
    lastSyncedAt: server.lastSyncedAt?.toISOString(),
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString()
  };
}

export function toCoolifyProject(project: PrismaCoolifyProject): CoolifyProjectCache {
  return {
    id: project.id,
    coolifyId: project.coolifyId,
    name: project.name,
    description: project.description ?? undefined,
    status: toCoolifyCacheStatus(project.status),
    remoteStatus: project.remoteStatus ?? undefined,
    isActive: project.isActive,
    lastSeenAt: project.lastSeenAt?.toISOString(),
    missingSince: project.missingSince?.toISOString(),
    removedAt: project.removedAt?.toISOString(),
    lastSyncedAt: project.lastSyncedAt?.toISOString(),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export function toCoolifyApplication(application: PrismaCoolifyApplication): CoolifyApplicationCache {
  return {
    id: application.id,
    coolifyId: application.coolifyId,
    name: application.name,
    fqdn: application.fqdn ?? undefined,
    status: toCoolifyCacheStatus(application.status),
    remoteStatus: application.remoteStatus ?? undefined,
    gitRepository: application.gitRepository ?? undefined,
    branch: application.branch ?? undefined,
    isActive: application.isActive,
    lastSeenAt: application.lastSeenAt?.toISOString(),
    missingSince: application.missingSince?.toISOString(),
    removedAt: application.removedAt?.toISOString(),
    lastSyncedAt: application.lastSyncedAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString()
  };
}

export function toProjectCoolifyLink(link: ProjectCoolifyLinkWithResources) {
  return {
    id: link.id,
    projectId: link.projectId,
    coolifyProject: link.coolifyProject ? toCoolifyProject(link.coolifyProject) : undefined,
    source: link.source ?? undefined,
    createdByMiniHost: link.createdByMiniHost,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString()
  };
}

export function toProjectDatabaseStatus(status: string): ProjectDatabaseStatus {
  if (
    status === "PROVISIONING" ||
    status === "FAILED" ||
    status === "CREATED_MANUALLY" ||
    status === "ACTIVE" ||
    status === "DISABLED" ||
    status === "ARCHIVED" ||
    status === "DESTROYED" ||
    status === "PARTIALLY_DESTROYED"
  ) {
    return status;
  }

  return "PLANNED";
}

export function toProjectDatabase(database: PrismaProjectDatabase): ProjectDatabase {
  return {
    id: database.id,
    projectId: database.projectId,
    name: database.name,
    databaseName: database.databaseName,
    databaseUser: database.databaseUser,
    host: database.host,
    port: database.port,
    status: toProjectDatabaseStatus(database.status),
    notes: database.notes ?? undefined,
    createdAt: database.createdAt.toISOString(),
    updatedAt: database.updatedAt.toISOString(),
    archivedAt: database.archivedAt?.toISOString(),
    hasPassword: Boolean(database.databasePasswordEncrypted),
    provisionedAt: database.provisionedAt?.toISOString(),
    lastProvisionError: database.lastProvisionError ?? undefined,
    disabledAt: database.disabledAt?.toISOString(),
    destroyedAt: database.destroyedAt?.toISOString(),
    lastDestructionError: database.lastDestructionError ?? undefined
  };
}

export function toDomain(domain: PrismaDomain): Domain {
  return {
    id: domain.id,
    name: domain.name,
    provider: domain.provider,
    zoneId: domain.zoneId ?? undefined,
    status: domain.status === "inactive" ? "inactive" : "active",
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString()
  };
}

export function toDnsRecordStatus(status: string): DnsRecordStatus {
  if (status === "DELETED") {
    return "DELETED";
  }

  return status === "inactive" ? "inactive" : "active";
}

export function toDnsRecord(record: DnsRecordWithProject): DnsRecord {
  return {
    id: record.id,
    domainId: record.domainId,
    projectId: record.projectId ?? undefined,
    projectName: record.project?.name,
    type: record.type as DnsRecord["type"],
    name: record.name,
    value: record.content,
    ttl: record.ttl ?? "auto",
    proxied: record.proxied,
    status: toDnsRecordStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    comment: record.comment ?? undefined,
    priority: record.priority ?? undefined,
    cloudflareRecordId: record.cloudflareRecordId ?? undefined,
    source: record.source === "cloudflare" ? "cloudflare" : "manual",
    lastSyncedAt: record.lastSyncedAt?.toISOString(),
    deletedAt: record.deletedAt?.toISOString(),
    deletedBy: record.deletedBy ?? undefined,
    deletionReason: record.deletionReason ?? undefined
  };
}

export function toHistoryItem(item: AuditLogWithUser): HistoryItem {
  return {
    id: item.id,
    action: item.action,
    entityType:
      item.entityType === "domain" ||
      item.entityType === "record" ||
      item.entityType === "settings" ||
      item.entityType === "project" ||
      item.entityType === "project_database" ||
      item.entityType === "project_application" ||
      item.entityType === "coolify"
        ? item.entityType
        : "settings",
    entityId: item.entityId ?? undefined,
    entityName: item.entityName ?? item.entityId ?? "Sistema",
    userId: item.userId ?? undefined,
    userName: item.user?.name,
    userEmail: item.user?.email,
    timestamp: item.createdAt.toISOString(),
    description: item.description,
    oldData: item.oldData ?? undefined,
    newData: item.newData ?? undefined
  };
}

export function toSettings(rows: AppSetting[]): MiniHostSettings {
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    defaultZoneId: values.get("defaultZoneId") ?? defaultSettings.defaultZoneId,
    defaultDomain: values.get("defaultDomain") ?? defaultSettings.defaultDomain,
    defaultVpsIp: values.get("defaultVpsIp") ?? defaultSettings.defaultVpsIp,
    defaultProxyEnabled: (values.get("defaultProxyEnabled") ?? String(defaultSettings.defaultProxyEnabled)) === "true",
    defaultPostgresHost: values.get("defaultPostgresHost") ?? defaultSettings.defaultPostgresHost,
    defaultPostgresPort: values.get("defaultPostgresPort") ?? defaultSettings.defaultPostgresPort,
    defaultPostgresDatabaseSuffix:
      values.get("defaultPostgresDatabaseSuffix") ?? defaultSettings.defaultPostgresDatabaseSuffix,
    defaultPostgresUserSuffix: values.get("defaultPostgresUserSuffix") ?? defaultSettings.defaultPostgresUserSuffix
  };
}

export function settingsEntries(settings: MiniHostSettings) {
  return [
    ["defaultZoneId", settings.defaultZoneId],
    ["defaultDomain", settings.defaultDomain],
    ["defaultVpsIp", settings.defaultVpsIp],
    ["defaultProxyEnabled", String(settings.defaultProxyEnabled)],
    ["defaultPostgresHost", settings.defaultPostgresHost],
    ["defaultPostgresPort", settings.defaultPostgresPort],
    ["defaultPostgresDatabaseSuffix", settings.defaultPostgresDatabaseSuffix],
    ["defaultPostgresUserSuffix", settings.defaultPostgresUserSuffix]
  ] as const;
}
