import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/server/audit";
import { handleRouteError, ok, readBody } from "@/lib/server/http";
import { defaultSettings, settingsEntries, toSettings } from "@/lib/server/mappers";
import type { MiniHostSettings } from "@/lib/types";

function normalizeSettings(body: Partial<MiniHostSettings>): MiniHostSettings {
  return {
    cloudflareApiToken: String(body.cloudflareApiToken ?? ""),
    defaultZoneId: String(body.defaultZoneId ?? ""),
    defaultDomain: String(body.defaultDomain ?? ""),
    defaultVpsIp: String(body.defaultVpsIp ?? ""),
    defaultProxyEnabled: Boolean(body.defaultProxyEnabled)
  };
}

export async function GET() {
  try {
    const rows = await prisma.appSetting.findMany();
    return ok({ settings: rows.length > 0 ? toSettings(rows) : defaultSettings });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = normalizeSettings(await readBody<Partial<MiniHostSettings>>(request));
    const rows = await prisma.appSetting.findMany();
    const previous = rows.length > 0 ? toSettings(rows) : defaultSettings;

    await prisma.$transaction(async (tx) => {
      for (const [key, value] of settingsEntries(body)) {
        await tx.appSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value }
        });
      }

      await writeAudit(tx, {
        action: "Configurações salvas",
        entityType: "settings",
        entityName: "Configurações",
        description: "Preferências salvas no banco.",
        oldData: previous,
        newData: body
      });
    });

    return ok({ settings: body });
  } catch (error) {
    return handleRouteError(error);
  }
}
