import type { CoolifyCredential, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import type { CoolifyConnectionStatus, CoolifyCredentialFormInput, CoolifyStatus } from "@/lib/types";

const DEFAULT_CREDENTIAL_NAME = "default";

export class CoolifyCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoolifyCredentialError";
  }
}

type DbClient = Prisma.TransactionClient | typeof prisma;

function isActiveCredential(credential: CoolifyCredential | null) {
  return Boolean(
    credential &&
      credential.status !== "DISABLED" &&
      credential.baseUrl.trim() &&
      credential.tokenEncrypted.trim()
  );
}

export function normalizeCoolifyBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new CoolifyCredentialError("Informe a URL base do Coolify.");
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new CoolifyCredentialError("Informe uma URL base válida para o Coolify.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new CoolifyCredentialError("A URL do Coolify deve começar com http:// ou https://.");
  }

  return normalized;
}

export function resolveCoolifyConnectionStatus(credential: CoolifyCredential | null): CoolifyConnectionStatus {
  if (!isActiveCredential(credential)) {
    return "not_configured";
  }

  if (credential?.lastTestStatus === "success") {
    return "connected";
  }

  if (credential?.lastTestStatus === "failed") {
    return "error";
  }

  return "not_tested";
}

export function toCoolifyStatus(credential: CoolifyCredential | null): CoolifyStatus {
  return {
    hasCredential: isActiveCredential(credential),
    connectionStatus: resolveCoolifyConnectionStatus(credential),
    credentialStatus: credential?.status,
    baseUrl: credential?.status !== "DISABLED" ? credential?.baseUrl : undefined,
    lastTestedAt: credential?.lastTestedAt?.toISOString(),
    lastTestMessage: credential?.lastTestMessage ?? undefined
  };
}

export async function getCoolifyCredential(db: DbClient = prisma) {
  return db.coolifyCredential.findUnique({
    where: { name: DEFAULT_CREDENTIAL_NAME }
  });
}

export async function getCoolifyClientStatus(db: DbClient = prisma) {
  const credential = await getCoolifyCredential(db);
  return toCoolifyStatus(credential);
}

export async function hasCoolifyCredential(db: DbClient = prisma) {
  const status = await getCoolifyClientStatus(db);
  return status.hasCredential;
}

export async function getCoolifyCredentialForApi(db: DbClient = prisma) {
  const credential = await getCoolifyCredential(db);

  if (!isActiveCredential(credential)) {
    throw new CoolifyCredentialError("Credencial do Coolify não configurada. Vá em Configurações para adicionar.");
  }

  try {
    return {
      baseUrl: credential!.baseUrl,
      token: decryptSecret(credential!.tokenEncrypted)
    };
  } catch {
    throw new CoolifyCredentialError("Não foi possível ler o token do Coolify. Salve um novo token em Configurações.");
  }
}

export async function saveCoolifyCredential(input: CoolifyCredentialFormInput, db: DbClient = prisma) {
  const baseUrl = normalizeCoolifyBaseUrl(input.baseUrl);
  const existing = await getCoolifyCredential(db);
  const tokenInput = input.token?.trim();

  if (!tokenInput && !isActiveCredential(existing)) {
    throw new CoolifyCredentialError("Informe o token da API do Coolify.");
  }

  const tokenEncrypted =
    tokenInput && tokenInput.length > 0
      ? encryptSecret(tokenInput)
      : existing!.tokenEncrypted;

  return db.coolifyCredential.upsert({
    where: { name: DEFAULT_CREDENTIAL_NAME },
    create: {
      name: DEFAULT_CREDENTIAL_NAME,
      baseUrl,
      tokenEncrypted,
      status: "ACTIVE"
    },
    update: {
      baseUrl,
      tokenEncrypted,
      status: "ACTIVE",
      lastTestStatus: null,
      lastTestMessage: null,
      lastTestedAt: null
    }
  });
}

export async function removeCoolifyCredential(db: DbClient = prisma) {
  const credential = await getCoolifyCredential(db);

  if (!credential) {
    return null;
  }

  return db.coolifyCredential.update({
    where: { id: credential.id },
    data: {
      tokenEncrypted: "",
      status: "DISABLED",
      lastTestStatus: null,
      lastTestMessage: null,
      lastTestedAt: null
    }
  });
}

export async function recordCoolifyTestResult(
  result: "success" | "failed",
  message: string,
  db: DbClient = prisma
) {
  const credential = await getCoolifyCredential(db);

  if (!credential) {
    return null;
  }

  return db.coolifyCredential.update({
    where: { id: credential.id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result,
      lastTestMessage: message,
      status: result === "success" ? "ACTIVE" : "INVALID"
    }
  });
}

export function sanitizeCoolifyCredentialForAudit(
  credential: CoolifyCredential | null | Record<string, unknown>
) {
  if (!credential) {
    return { hasCredential: false };
  }

  const { tokenEncrypted, ...safe } = credential as Record<string, unknown>;

  return {
    ...safe,
    hasToken: Boolean(tokenEncrypted)
  };
}
