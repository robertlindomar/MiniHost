import type { CloudflareCredential, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import type { CloudflareConnectionStatus, CloudflareStatus } from "@/lib/types";

const DEFAULT_CREDENTIAL_NAME = "default";
const LEGACY_TOKEN_KEY = "cloudflareApiToken";

export class CloudflareTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareTokenError";
  }
}

type DbClient = Prisma.TransactionClient | typeof prisma;

function isActiveCredential(credential: CloudflareCredential | null) {
  return Boolean(credential && credential.status === "ACTIVE" && credential.tokenEncrypted.trim());
}

export function resolveConnectionStatus(credential: CloudflareCredential | null): CloudflareConnectionStatus {
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

export function toCloudflareStatus(credential: CloudflareCredential | null): CloudflareStatus {
  return {
    hasToken: isActiveCredential(credential),
    connectionStatus: resolveConnectionStatus(credential),
    credentialStatus: credential?.status,
    lastTestedAt: credential?.lastTestedAt?.toISOString(),
    lastTestMessage: credential?.lastTestMessage ?? undefined
  };
}

export async function getCloudflareCredential(db: DbClient = prisma) {
  return db.cloudflareCredential.findUnique({
    where: { name: DEFAULT_CREDENTIAL_NAME }
  });
}

export async function migrateLegacyTokenIfNeeded(db: DbClient = prisma) {
  const existing = await getCloudflareCredential(db);

  if (isActiveCredential(existing)) {
    return existing;
  }

  const legacy = await db.appSetting.findUnique({
    where: { key: LEGACY_TOKEN_KEY }
  });
  const legacyToken = legacy?.value?.trim();

  if (!legacyToken) {
    return existing;
  }

  const encrypted = encryptSecret(legacyToken);
  const credential = await db.cloudflareCredential.upsert({
    where: { name: DEFAULT_CREDENTIAL_NAME },
    create: {
      name: DEFAULT_CREDENTIAL_NAME,
      tokenEncrypted: encrypted,
      status: "ACTIVE"
    },
    update: {
      tokenEncrypted: encrypted,
      status: "ACTIVE",
      lastTestStatus: null,
      lastTestMessage: null
    }
  });

  await db.appSetting.updateMany({
    where: { key: LEGACY_TOKEN_KEY },
    data: { value: "" }
  });

  return credential;
}

export async function getCloudflareClientStatus(db: DbClient = prisma) {
  await migrateLegacyTokenIfNeeded(db);
  const credential = await getCloudflareCredential(db);
  return toCloudflareStatus(credential);
}

export async function hasCloudflareToken(db: DbClient = prisma) {
  const status = await getCloudflareClientStatus(db);
  return status.hasToken;
}

export async function getCloudflareToken(db: DbClient = prisma) {
  await migrateLegacyTokenIfNeeded(db);
  const credential = await getCloudflareCredential(db);

  if (!isActiveCredential(credential)) {
    throw new CloudflareTokenError("Token da Cloudflare não configurado. Vá em Configurações para adicionar.");
  }

  try {
    return decryptSecret(credential!.tokenEncrypted);
  } catch {
    throw new CloudflareTokenError("Não foi possível ler o token da Cloudflare. Salve um novo token em Configurações.");
  }
}

export async function saveCloudflareToken(token: string, db: DbClient = prisma) {
  const normalized = token.trim();

  if (!normalized) {
    throw new CloudflareTokenError("Informe o token da Cloudflare.");
  }

  const encrypted = encryptSecret(normalized);

  if ("$transaction" in db) {
    return db.$transaction(async (tx) => {
      const credential = await tx.cloudflareCredential.upsert({
        where: { name: DEFAULT_CREDENTIAL_NAME },
        create: {
          name: DEFAULT_CREDENTIAL_NAME,
          tokenEncrypted: encrypted,
          status: "ACTIVE"
        },
        update: {
          tokenEncrypted: encrypted,
          status: "ACTIVE",
          lastTestStatus: null,
          lastTestMessage: null,
          lastTestedAt: null
        }
      });

      await tx.appSetting.updateMany({
        where: { key: LEGACY_TOKEN_KEY },
        data: { value: "" }
      });

      return credential;
    });
  }

  const credential = await db.cloudflareCredential.upsert({
    where: { name: DEFAULT_CREDENTIAL_NAME },
    create: {
      name: DEFAULT_CREDENTIAL_NAME,
      tokenEncrypted: encrypted,
      status: "ACTIVE"
    },
    update: {
      tokenEncrypted: encrypted,
      status: "ACTIVE",
      lastTestStatus: null,
      lastTestMessage: null,
      lastTestedAt: null
    }
  });

  await db.appSetting.updateMany({
    where: { key: LEGACY_TOKEN_KEY },
    data: { value: "" }
  });

  return credential;
}

export async function removeCloudflareToken(db: DbClient = prisma) {
  const credential = await getCloudflareCredential(db);

  if (!credential) {
    return null;
  }

  return db.cloudflareCredential.update({
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

export async function recordCloudflareTestResult(
  result: "success" | "failed",
  message: string,
  db: DbClient = prisma
) {
  const credential = await getCloudflareCredential(db);

  if (!credential) {
    return null;
  }

  return db.cloudflareCredential.update({
    where: { id: credential.id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result,
      lastTestMessage: message,
      status: result === "success" ? "ACTIVE" : "INVALID"
    }
  });
}
