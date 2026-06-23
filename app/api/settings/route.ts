import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { defaultSettings, settingsEntries, toSettings } from "@/lib/server/mappers";
import {
  getChangedSettingFields,
  getCloudflareTokenSource,
  isCloudflareConfigured,
  mergeSettingsToken,
  sanitizeSettingsForAudit,
  sanitizeSettingsForClient
} from "@/lib/server/settings";
import { validateSettingsBody } from "@/lib/server/validation";
import { isMaskedSecretValue } from "@/lib/settings";
import type { MiniHostSettings } from "@/lib/types";

function normalizeSettings(body: Partial<MiniHostSettings>): MiniHostSettings {
  return {
    cloudflareApiToken: String(body.cloudflareApiToken ?? ""),
    defaultZoneId: String(body.defaultZoneId ?? "").trim(),
    defaultDomain: String(body.defaultDomain ?? "").trim().toLowerCase(),
    defaultVpsIp: String(body.defaultVpsIp ?? "").trim(),
    defaultProxyEnabled: Boolean(body.defaultProxyEnabled)
  };
}

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const rows = await prisma.appSetting.findMany();
    const settings = rows.length > 0 ? toSettings(rows) : defaultSettings;
    const tokenSource = getCloudflareTokenSource(settings);

    return ok({
      settings: sanitizeSettingsForClient(settings),
      cloudflareConfigured: isCloudflareConfigured(settings),
      cloudflareTokenSource: tokenSource,
      hasStoredCloudflareToken: tokenSource !== "none"
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const incoming = normalizeSettings(await readBody<Partial<MiniHostSettings>>(request));
    const validation = validateSettingsBody(incoming);

    if (validation.errors.length > 0) {
      return fail(validation.errors[0], 400);
    }

    const rows = await prisma.appSetting.findMany();
    const previous = rows.length > 0 ? toSettings(rows) : defaultSettings;
    const next: MiniHostSettings = {
      ...validation.data,
      cloudflareApiToken: mergeSettingsToken(previous, incoming.cloudflareApiToken, {
        isMaskedOrEmpty: isMaskedSecretValue(incoming.cloudflareApiToken)
      })
    };

    await prisma.$transaction(async (tx) => {
      for (const [key, value] of settingsEntries(next)) {
        await tx.appSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value }
        });
      }

      const changedFields = getChangedSettingFields(previous, next);

      await writeAudit(tx, {
        action: "SETTINGS_UPDATE",
        entityType: "settings",
        userId: user.id,
        entityName: "Configurações",
        description:
          changedFields.length > 0
            ? `Configurações atualizadas: ${changedFields.join(", ")}.`
            : "Configurações salvas sem alterações.",
        oldData: sanitizeSettingsForAudit(previous),
        newData: sanitizeSettingsForAudit(next)
      });
    });

    return ok({
      settings: sanitizeSettingsForClient(next),
      cloudflareConfigured: isCloudflareConfigured(next),
      cloudflareTokenSource: getCloudflareTokenSource(next),
      hasStoredCloudflareToken: getCloudflareTokenSource(next) !== "none"
    });
  } catch (error) {
    try {
      const user = await requireCurrentUser(request).catch(() => null);

      if (user) {
        await writeAudit(prisma, {
          action: "SETTINGS_UPDATE_FAILED",
          entityType: "settings",
          userId: user.id,
          entityName: "Configurações",
          description: "Não foi possível salvar as configurações.",
          newData: { result: "failed" }
        });
      }
    } catch {
      // Ignore secondary audit failures.
    }

    return handleRouteError(error);
  }
}
