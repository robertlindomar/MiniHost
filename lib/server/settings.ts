import type { MiniHostSettings } from "@/lib/types";

export function sanitizeSettingsForClient(settings: MiniHostSettings): MiniHostSettings {
  return settings;
}

export function sanitizeSettingsForAudit(settings: MiniHostSettings) {
  return {
    defaultZoneId: settings.defaultZoneId,
    defaultDomain: settings.defaultDomain,
    defaultVpsIp: settings.defaultVpsIp,
    defaultProxyEnabled: settings.defaultProxyEnabled
  };
}

export function getChangedSettingFields(previous: MiniHostSettings, next: MiniHostSettings) {
  const changes: string[] = [];

  (Object.keys(next) as Array<keyof MiniHostSettings>).forEach((key) => {
    if (previous[key] !== next[key]) {
      changes.push(key);
    }
  });

  return changes;
}
