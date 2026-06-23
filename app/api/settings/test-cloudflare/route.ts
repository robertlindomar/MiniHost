import { listDnsRecords, CloudflareApiError } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { defaultSettings, toSettings } from "@/lib/server/mappers";
import { isCloudflareConfigured } from "@/lib/server/settings";
import { isPlausibleZoneId } from "@/lib/validation";

type TestConnectionBody = {
  zoneId?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<TestConnectionBody>(request);
    const rows = await prisma.appSetting.findMany();
    const settings = rows.length > 0 ? toSettings(rows) : defaultSettings;
    const zoneId = String(body.zoneId ?? settings.defaultZoneId ?? "").trim();

    if (!isCloudflareConfigured(settings)) {
      return fail("Token da Cloudflare não configurado.", 400);
    }

    if (!zoneId) {
      return fail("Informe o Zone ID padrão para testar a conexão.", 400);
    }

    if (!isPlausibleZoneId(zoneId)) {
      return fail("Zone ID deve ter um formato plausível.", 400);
    }

    try {
      await listDnsRecords(zoneId);

      await writeAudit(prisma, {
        action: "CLOUDFLARE_CONNECTION_TEST",
        entityType: "settings",
        userId: user.id,
        entityName: "Cloudflare",
        description: "Conexão com Cloudflare validada com sucesso.",
        newData: { zoneId, result: "success" }
      });

      return ok({ message: "Conexão com Cloudflare validada com sucesso." });
    } catch (error) {
      const message =
        error instanceof CloudflareApiError
          ? error.message
          : "Não foi possível validar a conexão com Cloudflare.";

      await writeAudit(prisma, {
        action: "CLOUDFLARE_CONNECTION_TEST_FAILED",
        entityType: "settings",
        userId: user.id,
        entityName: "Cloudflare",
        description: message,
        newData: { zoneId, result: "failed" }
      });

      return fail(message, 400);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
