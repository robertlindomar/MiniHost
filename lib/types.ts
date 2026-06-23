export type EntityStatus = "active" | "inactive";

export type ProjectStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

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
  entityType: "domain" | "record" | "settings" | "project";
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
}

export type CloudflareConnectionStatus = "connected" | "not_configured" | "error" | "not_tested";

export interface CloudflareStatus {
  hasToken: boolean;
  connectionStatus: CloudflareConnectionStatus;
  credentialStatus?: "ACTIVE" | "INVALID" | "DISABLED";
  lastTestedAt?: string;
  lastTestMessage?: string;
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
