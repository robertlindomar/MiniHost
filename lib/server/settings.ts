import type { MiniHostSettings } from "@/lib/types";

const SENSITIVE_SETTING_KEYS = new Set(["cloudflareApiToken"]);

export function sanitizeSettingsForClient(settings: MiniHostSettings): MiniHostSettings {
  return {
    ...settings,
    cloudflareApiToken: ""
  };
}

export function sanitizeSettingsForAudit(settings: MiniHostSettings) {
  return {
    defaultZoneId: settings.defaultZoneId,
    defaultDomain: settings.defaultDomain,
    defaultVpsIp: settings.defaultVpsIp,
    defaultProxyEnabled: settings.defaultProxyEnabled,
    cloudflareApiToken: settings.cloudflareApiToken ? "Cloudflare API Token alterado" : "Cloudflare API Token não alterado"
  };
}

export function getChangedSettingFields(previous: MiniHostSettings, next: MiniHostSettings) {
  const changes: string[] = [];

  (Object.keys(next) as Array<keyof MiniHostSettings>).forEach((key) => {
    if (previous[key] !== next[key]) {
      if (SENSITIVE_SETTING_KEYS.has(key)) {
        changes.push("cloudflareApiToken");
      } else {
        changes.push(key);
      }
    }
  });

  return changes;
}

export function mergeSettingsToken(
  previous: MiniHostSettings,
  incomingToken: string,
  options: { isMaskedOrEmpty: boolean }
) {
  if (options.isMaskedOrEmpty) {
    return previous.cloudflareApiToken;
  }

  return incomingToken.trim();
}

export type CloudflareTokenSource = "environment" | "database" | "none";

export function getCloudflareTokenSource(settings: MiniHostSettings): CloudflareTokenSource {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return "environment";
  }

  if (settings.cloudflareApiToken.trim()) {
    return "database";
  }

  return "none";
}

export function isCloudflareConfigured(settings: MiniHostSettings) {
  return getCloudflareTokenSource(settings) !== "none";
}
