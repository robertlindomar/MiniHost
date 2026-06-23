import type { MiniHostSettings } from "@/lib/types";
import { isDomainLike, isPlausibleZoneId, isValidIPv4 } from "@/lib/validation";

export const MASKED_SECRET_VALUE = "••••••••••••••••";

export type SettingsFieldErrors = Partial<Record<keyof MiniHostSettings, string>>;

export function isMaskedSecretValue(value: string) {
  const normalized = value.trim();
  return !normalized || normalized === MASKED_SECRET_VALUE || /^•+$/.test(normalized);
}

export function validateSettingsInput(input: Partial<MiniHostSettings>) {
  const errors: SettingsFieldErrors = {};
  const defaultDomain = String(input.defaultDomain ?? "").trim().toLowerCase();
  const defaultVpsIp = String(input.defaultVpsIp ?? "").trim();
  const defaultZoneId = String(input.defaultZoneId ?? "").trim();

  if (defaultDomain && (defaultDomain.includes("://") || /\s/.test(defaultDomain))) {
    errors.defaultDomain = "Informe apenas o domínio, sem http:// ou https://.";
  } else if (defaultDomain && !isDomainLike(defaultDomain)) {
    errors.defaultDomain = "Informe um domínio válido, como exemplo.com.";
  }

  if (defaultVpsIp && !isValidIPv4(defaultVpsIp)) {
    errors.defaultVpsIp = "IP inválido. Verifique o formato e tente novamente.";
  }

  if (defaultZoneId && !isPlausibleZoneId(defaultZoneId)) {
    errors.defaultZoneId = "Zone ID deve ter um formato plausível.";
  }

  const data: MiniHostSettings = {
    defaultZoneId,
    defaultDomain,
    defaultVpsIp,
    defaultProxyEnabled: Boolean(input.defaultProxyEnabled),
    defaultPostgresHost: String(input.defaultPostgresHost ?? "").trim(),
    defaultPostgresPort: String(input.defaultPostgresPort ?? "5432").trim(),
    defaultPostgresDatabaseSuffix: String(input.defaultPostgresDatabaseSuffix ?? "_db").trim(),
    defaultPostgresUserSuffix: String(input.defaultPostgresUserSuffix ?? "_user").trim()
  };

  const postgresPort = Number(data.defaultPostgresPort);

  if (data.defaultPostgresPort && (!Number.isFinite(postgresPort) || postgresPort < 1 || postgresPort > 65535)) {
    errors.defaultPostgresPort = "Porta PostgreSQL deve estar entre 1 e 65535.";
  }

  if (data.defaultPostgresDatabaseSuffix && !/^[a-z0-9_]+$/.test(data.defaultPostgresDatabaseSuffix)) {
    errors.defaultPostgresDatabaseSuffix = "Sufixo do banco deve conter apenas letras minúsculas, números e underscore.";
  }

  if (data.defaultPostgresUserSuffix && !/^[a-z0-9_]+$/.test(data.defaultPostgresUserSuffix)) {
    errors.defaultPostgresUserSuffix = "Sufixo do usuário deve conter apenas letras minúsculas, números e underscore.";
  }

  return {
    errors,
    data,
    isValid: Object.keys(errors).length === 0
  };
}

export function getSettingsWarnings(settings: Pick<MiniHostSettings, "defaultZoneId" | "defaultVpsIp">) {
  const warnings: string[] = [];

  if (!settings.defaultZoneId.trim()) {
    warnings.push("Zone ID ausente. A sincronização com Cloudflare pode ficar indisponível.");
  }

  if (!settings.defaultVpsIp.trim()) {
    warnings.push("IP padrão da VPS ausente. Alguns templates ficarão desabilitados.");
  }

  return warnings;
}
