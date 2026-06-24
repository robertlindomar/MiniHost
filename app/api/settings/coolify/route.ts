import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  CoolifyCredentialError,
  getCoolifyClientStatus,
  removeCoolifyCredential,
  sanitizeCoolifyCredentialForAudit,
  saveCoolifyCredential
} from "@/lib/server/coolify-credential";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import type { CoolifyCredentialFormInput } from "@/lib/types";

type SaveCoolifyCredentialBody = Partial<CoolifyCredentialFormInput>;

function normalizeBody(body: SaveCoolifyCredentialBody): CoolifyCredentialFormInput {
  return {
    baseUrl: String(body.baseUrl ?? "").trim(),
    token: body.token ? String(body.token) : undefined
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = normalizeBody(await readBody<SaveCoolifyCredentialBody>(request));
    const credential = await saveCoolifyCredential(body, prisma);

    await writeAudit(prisma, {
      action: "COOLIFY_CREDENTIAL_SAVED",
      entityType: "settings",
      userId: user.id,
      entityName: "Coolify",
      description: "Configuração do Coolify salva com sucesso.",
      newData: sanitizeCoolifyCredentialForAudit(credential)
    });

    const coolify = await getCoolifyClientStatus();

    return ok({
      message: "Configuração do Coolify salva com sucesso.",
      coolify
    });
  } catch (error) {
    if (error instanceof CoolifyCredentialError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const removed = await removeCoolifyCredential(prisma);

    if (!removed) {
      return fail("Nenhuma configuração do Coolify estava salva.", 400);
    }

    await writeAudit(prisma, {
      action: "COOLIFY_CREDENTIAL_REMOVED",
      entityType: "settings",
      userId: user.id,
      entityName: "Coolify",
      description: "Configuração do Coolify removida com sucesso.",
      newData: { result: "removed" }
    });

    const coolify = await getCoolifyClientStatus();

    return ok({
      message: "Configuração do Coolify removida com sucesso.",
      coolify
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
