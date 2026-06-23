import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  CloudflareTokenError,
  getCloudflareClientStatus,
  removeCloudflareToken,
  saveCloudflareToken
} from "@/lib/server/cloudflare-credential";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";

type SaveTokenBody = {
  token?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<SaveTokenBody>(request);
    const token = String(body.token ?? "").trim();

    if (!token) {
      return fail("Informe o token da Cloudflare.", 400);
    }

    await saveCloudflareToken(token, prisma);

    await writeAudit(prisma, {
      action: "CLOUDFLARE_TOKEN_SAVED",
      entityType: "settings",
      userId: user.id,
      entityName: "Cloudflare",
      description: "Token da Cloudflare salvo com sucesso.",
      newData: { result: "saved" }
    });

    const cloudflare = await getCloudflareClientStatus();

    return ok({
      message: "Token da Cloudflare salvo com sucesso.",
      cloudflare,
      cloudflareConfigured: cloudflare.hasToken,
      hasStoredCloudflareToken: cloudflare.hasToken
    });
  } catch (error) {
    if (error instanceof CloudflareTokenError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const removed = await removeCloudflareToken(prisma);

    if (!removed) {
      return fail("Nenhum token da Cloudflare estava configurado.", 400);
    }

    await writeAudit(prisma, {
      action: "CLOUDFLARE_TOKEN_REMOVED",
      entityType: "settings",
      userId: user.id,
      entityName: "Cloudflare",
      description: "Token da Cloudflare removido com sucesso.",
      newData: { result: "removed" }
    });

    const cloudflare = await getCloudflareClientStatus();

    return ok({
      message: "Token removido com sucesso.",
      cloudflare,
      cloudflareConfigured: false,
      hasStoredCloudflareToken: false
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
