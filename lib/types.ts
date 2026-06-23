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
  entityType: "domain" | "record" | "settings" | "project" | "project_database";
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
