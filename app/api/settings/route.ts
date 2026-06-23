import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { getCloudflareClientStatus } from "@/lib/server/cloudflare-credential";
import { getPostgresAdminClientStatus } from "@/lib/server/postgres-admin-credential";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { defaultSettings, settingsEntries, toSettings } from "@/lib/server/mappers";
import {
  getChangedSettingFields,
  sanitizeSettingsForAudit,
  sanitizeSettingsForClient
} from "@/lib/server/settings";
import { validateSettingsBody } from "@/lib/server/validation";
import type { MiniHostSettings } from "@/lib/types";

function normalizeSettings(body: Partial<MiniHostSettings>): MiniHostSettings {
  return {
    defaultZoneId: String(body.defaultZoneId ?? "").trim(),
    defaultDomain: String(body.defaultDomain ?? "").trim().toLowerCase(),
    defaultVpsIp: String(body.defaultVpsIp ?? "").trim(),
    defaultProxyEnabled: Boolean(body.defaultProxyEnabled),
    defaultPostgresHost: String(body.defaultPostgresHost ?? "").trim(),
    defaultPostgresPort: String(body.defaultPostgresPort ?? "5432").trim(),
    defaultPostgresDatabaseSuffix: String(body.defaultPostgresDatabaseSuffix ?? "_db").trim(),
    defaultPostgresUserSuffix: String(body.defaultPostgresUserSuffix ?? "_user").trim()
  };
}

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const rows = await prisma.appSetting.findMany();
    const settings = rows.length > 0 ? toSettings(rows) : defaultSettings;
    const cloudflare = await getCloudflareClientStatus();
    const postgresAdmin = await getPostgresAdminClientStatus();

    return ok({
      settings: sanitizeSettingsForClient(settings),
      cloudflare,
      cloudflareConfigured: cloudflare.hasToken,
      hasStoredCloudflareToken: cloudflare.hasToken,
      postgresAdmin
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
    const next: MiniHostSettings = validation.data;

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

    const cloudflare = await getCloudflareClientStatus();
    const postgresAdmin = await getPostgresAdminClientStatus();

    return ok({
      settings: sanitizeSettingsForClient(next),
      cloudflare,
      cloudflareConfigured: cloudflare.hasToken,
      hasStoredCloudflareToken: cloudflare.hasToken,
      postgresAdmin
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
