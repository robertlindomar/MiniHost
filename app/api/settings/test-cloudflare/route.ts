import { listDnsRecords, CloudflareApiError } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  CloudflareTokenError,
  getCloudflareToken,
  hasCloudflareToken,
  recordCloudflareTestResult
} from "@/lib/server/cloudflare-credential";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { defaultSettings, toSettings } from "@/lib/server/mappers";
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

    if (!(await hasCloudflareToken())) {
      return fail("Configure o token da Cloudflare antes de testar a conexão.", 400);
    }

    if (!zoneId) {
      return fail("Configure o Zone ID padrão antes de testar a conexão.", 400);
    }

    if (!isPlausibleZoneId(zoneId)) {
      return fail("Zone ID deve ter um formato plausível.", 400);
    }

    try {
      const token = await getCloudflareToken();
      await listDnsRecords(zoneId, token);
      const message = "Conexão com Cloudflare testada com sucesso.";

      await recordCloudflareTestResult("success", message, prisma);

      await writeAudit(prisma, {
        action: "CLOUDFLARE_TOKEN_TEST_SUCCESS",
        entityType: "settings",
        userId: user.id,
        entityName: "Cloudflare",
        description: message,
        newData: { zoneId, result: "success" }
      });

      return ok({ message });
    } catch (error) {
      const message =
        error instanceof CloudflareApiError
          ? error.message
          : "Não foi possível conectar à Cloudflare. Verifique o token e o Zone ID.";

      await recordCloudflareTestResult("failed", message, prisma);

      await writeAudit(prisma, {
        action: "CLOUDFLARE_TOKEN_TEST_FAILED",
        entityType: "settings",
        userId: user.id,
        entityName: "Cloudflare",
        description: message,
        newData: { zoneId, result: "failed" }
      });

      return fail(message, 400);
    }
  } catch (error) {
    if (error instanceof CloudflareTokenError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
