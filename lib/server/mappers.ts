import type {
  AppSetting,
  AuditLog,
  CoolifyApplication as PrismaCoolifyApplication,
  CoolifyProject as PrismaCoolifyProject,
  CoolifyServer as PrismaCoolifyServer,
  DnsRecord as PrismaDnsRecord,
  Domain as PrismaDomain,
  Project as PrismaProject,
  ProjectCoolifyLink as PrismaProjectCoolifyLink,
  ProjectDatabase as PrismaProjectDatabase
} from "@prisma/client";
import type {
  CoolifyApplicationCache,
  CoolifyProjectCache,
  CoolifyServerCache,
  DnsRecord,
  DnsRecordStatus,
  Domain,
  HistoryItem,
  MiniHostSettings,
  Project,
  ProjectDatabase,
  ProjectDatabaseStatus,
  ProjectStatus
} from "@/lib/types";

type DnsRecordWithProject = PrismaDnsRecord & {
  project?: {
    id: string;
    name: string;
  } | null;
};

type ProjectWithCount = PrismaProject & {
  _count?: {
    records: number;
    databases?: number;
  };
  coolifyLink?: ProjectCoolifyLinkWithResources | null;
};

type ProjectCoolifyLinkWithResources = PrismaProjectCoolifyLink & {
  coolifyProject?: PrismaCoolifyProject | null;
  coolifyApplication?: PrismaCoolifyApplication | null;
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

export function toProjectStatus(status: string): ProjectStatus {
  if (status === "ACTIVE" || status === "PAUSED" || status === "ARCHIVED") {
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
    recordCount: project._count?.records,
    databaseCount: project._count?.databases,
    coolifyLink: project.coolifyLink ? toProjectCoolifyLink(project.coolifyLink) : undefined
  };
}

export function toCoolifyServer(server: PrismaCoolifyServer): CoolifyServerCache {
  return {
    id: server.id,
    coolifyId: server.coolifyId,
    name: server.name,
    description: server.description ?? undefined,
    status: server.status ?? undefined,
    ip: server.ip ?? undefined,
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
    status: application.status ?? undefined,
    gitRepository: application.gitRepository ?? undefined,
    branch: application.branch ?? undefined,
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
    coolifyApplication: link.coolifyApplication ? toCoolifyApplication(link.coolifyApplication) : undefined,
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
