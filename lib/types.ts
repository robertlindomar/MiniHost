export type EntityStatus = "active" | "inactive";

export type ProjectStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export type ProjectDatabaseStatus =
  | "PLANNED"
  | "PROVISIONING"
  | "ACTIVE"
  | "FAILED"
  | "CREATED_MANUALLY"
  | "DISABLED"
  | "ARCHIVED"
  | "DESTROYED"
  | "PARTIALLY_DESTROYED";

export type ProjectApplicationStatus =
  | "DRAFT"
  | "READY"
  | "LINKED"
  | "ENVS_APPLIED"
  | "DEPLOYING"
  | "DEPLOYED"
  | "FAILED"
  | "ARCHIVED";

export type ProjectApplicationType =
  | "FRONTEND"
  | "BACKEND"
  | "FULLSTACK"
  | "STATIC"
  | "DOCKERFILE"
  | "DOCKER_COMPOSE"
  | "OTHER";

export type DnsRecordStatus = EntityStatus | "DELETED";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX";

export type TtlValue = "auto" | number;

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: ProjectStatus;
  mainDomain?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  recordCount?: number;
  databaseCount?: number;
  applicationCount?: number;
  coolifyLink?: ProjectCoolifyLink;
}

export interface ProjectApplicationEnvVar {
  key: string;
  value: string;
}

export interface ProjectApplicationReadiness {
  ready: boolean;
  issues: string[];
  checks: {
    hasName: boolean;
    hasSlug: boolean;
    hasRepository: boolean;
    hasBranch: boolean;
    hasDomain: boolean;
    hasPort: boolean;
    hasBuildCommand: boolean;
    hasStartCommand: boolean;
    hasOutputDirectory: boolean;
    hasDatabaseUrl: boolean;
    hasCoolifyLink: boolean;
  };
}

export interface ProjectApplication {
  id: string;
  projectId: string;
  projectDatabaseId?: string;
  dnsRecordId?: string;
  name: string;
  slug: string;
  type: ProjectApplicationType;
  status: ProjectApplicationStatus;
  gitRepository?: string;
  gitBranch?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
  port?: number;
  domain?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  environmentVariables?: ProjectApplicationEnvVar[];
  environmentVariableKeys?: string[];
  readiness?: ProjectApplicationReadiness;
  projectDatabase?: ProjectDatabase;
  dnsRecord?: DnsRecord;
  coolifyServer?: CoolifyServerCache;
  coolifyProject?: CoolifyProjectCache;
  coolifyApplication?: CoolifyApplicationCache;
  provisionedAt?: string;
  provisionedBy?: string;
  lastProvisionStatus?: string;
  lastProvisionMessage?: string;
  envsAppliedAt?: string;
  lastEnvsApplyStatus?: string;
  lastEnvsApplyMessage?: string;
  lastDeployStartedAt?: string;
  lastDeployStatus?: string;
  lastDeployMessage?: string;
  lastCoolifySyncAt?: string;
}

export interface ProjectApplicationFormInput {
  name: string;
  slug?: string;
  type: ProjectApplicationType;
  gitRepository?: string;
  gitBranch?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
  port?: number | string | null;
  domain?: string;
  notes?: string;
  projectDatabaseId?: string | null;
  dnsRecordId?: string | null;
  environmentVariables?: ProjectApplicationEnvVar[];
}

export interface ProjectDatabase {
  id: string;
  projectId: string;
  name: string;
  databaseName: string;
  databaseUser: string;
  host: string;
  port: number;
  status: ProjectDatabaseStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  hasPassword: boolean;
  provisionedAt?: string;
  lastProvisionError?: string;
  disabledAt?: string;
  destroyedAt?: string;
  lastDestructionError?: string;
}

export interface ProjectDatabaseFormInput {
  name: string;
  databaseName: string;
  databaseUser: string;
  password?: string;
  generatePassword?: boolean;
  host: string;
  port: number;
  status?: ProjectDatabaseStatus;
  notes?: string;
}

export interface ProjectDatabaseSuggestions {
  name: string;
  databaseName: string;
  databaseUser: string;
  host: string;
  port: number;
}

export interface ProjectFormInput {
  name: string;
  slug: string;
  description?: string;
  status: ProjectStatus;
  mainDomain?: string;
}

export interface Domain {
  id: string;
  name: string;
  provider: string;
  zoneId?: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  id: string;
  domainId: string;
  projectId?: string;
  projectName?: string;
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: TtlValue;
  proxied: boolean;
  status: DnsRecordStatus;
  createdAt: string;
  updatedAt: string;
  comment?: string;
  priority?: number;
  cloudflareRecordId?: string;
  source: "manual" | "cloudflare";
  lastSyncedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
}

export interface HistoryItem {
  id: string;
  action: string;
  entityType: "domain" | "record" | "settings" | "project" | "project_database" | "project_application" | "coolify";
  entityId?: string;
  entityName: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  timestamp: string;
  description: string;
  oldData?: unknown;
  newData?: unknown;
}

export interface MiniHostSettings {
  defaultZoneId: string;
  defaultDomain: string;
  defaultVpsIp: string;
  defaultProxyEnabled: boolean;
  defaultPostgresHost: string;
  defaultPostgresPort: string;
  defaultPostgresDatabaseSuffix: string;
  defaultPostgresUserSuffix: string;
}

export type CloudflareConnectionStatus = "connected" | "not_configured" | "error" | "not_tested";

export interface CloudflareStatus {
  hasToken: boolean;
  connectionStatus: CloudflareConnectionStatus;
  credentialStatus?: "ACTIVE" | "INVALID" | "DISABLED";
  lastTestedAt?: string;
  lastTestMessage?: string;
}

export type PostgresConnectionStatus = "connected" | "not_configured" | "error" | "not_tested";

export interface PostgresAdminStatus {
  hasCredential: boolean;
  connectionStatus: PostgresConnectionStatus;
  credentialStatus?: "ACTIVE" | "INVALID" | "DISABLED";
  host?: string;
  port?: number;
  maintenanceDatabase?: string;
  username?: string;
  sslEnabled?: boolean;
  lastTestedAt?: string;
  lastTestMessage?: string;
}

export interface PostgresAdminCredentialFormInput {
  host: string;
  port: number;
  maintenanceDatabase: string;
  username: string;
  password?: string;
  sslEnabled: boolean;
}

export type CoolifyConnectionStatus = "connected" | "not_configured" | "error" | "not_tested";

export interface CoolifyStatus {
  hasCredential: boolean;
  connectionStatus: CoolifyConnectionStatus;
  credentialStatus?: "ACTIVE" | "INVALID" | "DISABLED";
  baseUrl?: string;
  lastTestedAt?: string;
  lastTestMessage?: string;
}

export interface CoolifyCredentialFormInput {
  baseUrl: string;
  token?: string;
}

export type CoolifyCacheStatus = "ACTIVE" | "MISSING" | "REMOVED" | "ERROR";

export interface CoolifyServerCache {
  id: string;
  coolifyId: string;
  name: string;
  description?: string;
  status: CoolifyCacheStatus;
  remoteStatus?: string;
  ip?: string;
  isActive: boolean;
  lastSeenAt?: string;
  missingSince?: string;
  removedAt?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoolifyProjectCache {
  id: string;
  coolifyId: string;
  name: string;
  description?: string;
  status: CoolifyCacheStatus;
  remoteStatus?: string;
  isActive: boolean;
  lastSeenAt?: string;
  missingSince?: string;
  removedAt?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoolifyApplicationCache {
  id: string;
  coolifyId: string;
  name: string;
  fqdn?: string;
  status: CoolifyCacheStatus;
  remoteStatus?: string;
  gitRepository?: string;
  branch?: string;
  isActive: boolean;
  lastSeenAt?: string;
  missingSince?: string;
  removedAt?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCoolifyLink {
  id: string;
  projectId: string;
  coolifyProject?: CoolifyProjectCache;
  coolifyApplication?: CoolifyApplicationCache;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDatabasePermissionDetail {
  databaseName: string;
  canConnect: boolean;
  isProjectDatabase: boolean;
  publicCanConnect: boolean;
}

export interface ProjectDatabasePermissionVerification {
  ok: boolean;
  projectDatabaseName: string;
  projectUser: string;
  connectableDatabases: string[];
  unexpectedDatabases: string[];
  publicConnectWarnings: string[];
  details: ProjectDatabasePermissionDetail[];
}

export interface DomainFormInput {
  name: string;
  provider: string;
  zoneId?: string;
  status: EntityStatus;
}

export interface DnsRecordFormInput {
  domainId: string;
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: TtlValue;
  proxied: boolean;
  status: EntityStatus;
  comment?: string;
  priority?: number;
  createInCloudflare?: boolean;
  templateName?: string;
  projectId?: string;
  fromProjectTemplate?: boolean;
}
