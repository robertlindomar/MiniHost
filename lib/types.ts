export type EntityStatus = "active" | "inactive";

export type DnsRecordStatus = EntityStatus | "DELETED";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX";

export type TtlValue = "auto" | number;

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
  entityType: "domain" | "record" | "settings";
  entityName: string;
  userName?: string;
  userEmail?: string;
  timestamp: string;
  description: string;
}

export interface MiniHostSettings {
  cloudflareApiToken: string;
  defaultZoneId: string;
  defaultDomain: string;
  defaultVpsIp: string;
  defaultProxyEnabled: boolean;
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
}
