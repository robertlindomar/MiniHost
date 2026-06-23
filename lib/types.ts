export type EntityStatus = "active" | "inactive";

export type DnsRecordType = "A" | "CNAME" | "TXT" | "MX";

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
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
  comment?: string;
  priority?: number;
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
}
