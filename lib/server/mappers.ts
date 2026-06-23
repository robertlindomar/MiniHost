import type {
  AppSetting,
  AuditLog,
  DnsRecord as PrismaDnsRecord,
  Domain as PrismaDomain
} from "@prisma/client";
import type { DnsRecord, Domain, HistoryItem, MiniHostSettings } from "@/lib/types";

type AuditLogWithUser = AuditLog & {
  user?: {
    name: string;
    email: string;
  } | null;
};

export const defaultSettings: MiniHostSettings = {
  cloudflareApiToken: "",
  defaultZoneId: "fake-zone-robertlindomar",
  defaultDomain: "robertlindomar.dev",
  defaultVpsIp: "72.60.250.39",
  defaultProxyEnabled: true
};

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

export function toDnsRecord(record: PrismaDnsRecord): DnsRecord {
  return {
    id: record.id,
    domainId: record.domainId,
    type: record.type as DnsRecord["type"],
    name: record.name,
    value: record.content,
    ttl: record.ttl ?? "auto",
    proxied: record.proxied,
    status: record.status === "inactive" ? "inactive" : "active",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    comment: record.comment ?? undefined,
    priority: record.priority ?? undefined
  };
}

export function toHistoryItem(item: AuditLogWithUser): HistoryItem {
  return {
    id: item.id,
    action: item.action,
    entityType:
      item.entityType === "domain" || item.entityType === "record" || item.entityType === "settings"
        ? item.entityType
        : "settings",
    entityName: item.entityName ?? item.entityId ?? "Sistema",
    userName: item.user?.name,
    userEmail: item.user?.email,
    timestamp: item.createdAt.toISOString(),
    description: item.description
  };
}

export function toSettings(rows: AppSetting[]): MiniHostSettings {
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    cloudflareApiToken: values.get("cloudflareApiToken") ?? defaultSettings.cloudflareApiToken,
    defaultZoneId: values.get("defaultZoneId") ?? defaultSettings.defaultZoneId,
    defaultDomain: values.get("defaultDomain") ?? defaultSettings.defaultDomain,
    defaultVpsIp: values.get("defaultVpsIp") ?? defaultSettings.defaultVpsIp,
    defaultProxyEnabled: (values.get("defaultProxyEnabled") ?? String(defaultSettings.defaultProxyEnabled)) === "true"
  };
}

export function settingsEntries(settings: MiniHostSettings) {
  return [
    ["cloudflareApiToken", settings.cloudflareApiToken],
    ["defaultZoneId", settings.defaultZoneId],
    ["defaultDomain", settings.defaultDomain],
    ["defaultVpsIp", settings.defaultVpsIp],
    ["defaultProxyEnabled", String(settings.defaultProxyEnabled)]
  ] as const;
}
