import type { PostgresAdminCredential, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import type { PostgresAdminStatus, PostgresConnectionStatus } from "@/lib/types";

const DEFAULT_CREDENTIAL_NAME = "default";

export class PostgresAdminCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresAdminCredentialError";
  }
}

export type PostgresAdminCredentialInput = {
  host: string;
  port: number;
  maintenanceDatabase: string;
  username: string;
  password?: string;
  sslEnabled: boolean;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function isActiveCredential(credential: PostgresAdminCredential | null) {
  return Boolean(credential && credential.status !== "DISABLED" && credential.passwordEncrypted.trim());
}

export function resolvePostgresConnectionStatus(
  credential: PostgresAdminCredential | null
): PostgresConnectionStatus {
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

export function toPostgresAdminStatus(credential: PostgresAdminCredential | null): PostgresAdminStatus {
  return {
    hasCredential: isActiveCredential(credential),
    connectionStatus: resolvePostgresConnectionStatus(credential),
    credentialStatus: credential?.status,
    host: credential?.host,
    port: credential?.port,
    maintenanceDatabase: credential?.maintenanceDatabase,
    username: credential?.username,
    sslEnabled: credential?.sslEnabled,
    lastTestedAt: credential?.lastTestedAt?.toISOString(),
    lastTestMessage: credential?.lastTestMessage ?? undefined
  };
}

export async function getPostgresAdminCredential(db: DbClient = prisma) {
  return db.postgresAdminCredential.findUnique({
    where: { name: DEFAULT_CREDENTIAL_NAME }
  });
}

export async function getPostgresAdminClientStatus(db: DbClient = prisma) {
  const credential = await getPostgresAdminCredential(db);
  return toPostgresAdminStatus(credential);
}

export async function hasPostgresAdminCredential(db: DbClient = prisma) {
  const status = await getPostgresAdminClientStatus(db);
  return status.hasCredential;
}

export async function getPostgresAdminPassword(db: DbClient = prisma) {
  const credential = await getPostgresAdminCredential(db);

  if (!isActiveCredential(credential)) {
    throw new PostgresAdminCredentialError(
      "Credencial administrativa PostgreSQL não configurada. Vá em Configurações para adicionar."
    );
  }

  try {
    return decryptSecret(credential!.passwordEncrypted);
  } catch {
    throw new PostgresAdminCredentialError(
      "Não foi possível ler a credencial PostgreSQL. Salve uma nova credencial em Configurações."
    );
  }
}

export async function savePostgresAdminCredential(input: PostgresAdminCredentialInput, db: DbClient = prisma) {
  const host = input.host.trim();
  const maintenanceDatabase = input.maintenanceDatabase.trim();
  const username = input.username.trim();
  const port = input.port;

  if (!host) {
    throw new PostgresAdminCredentialError("Informe o host PostgreSQL.");
  }

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new PostgresAdminCredentialError("Informe uma porta válida.");
  }

  if (!maintenanceDatabase) {
    throw new PostgresAdminCredentialError("Informe o database de manutenção.");
  }

  if (!username) {
    throw new PostgresAdminCredentialError("Informe o usuário administrativo.");
  }

  const existing = await getPostgresAdminCredential(db);
  const passwordInput = input.password?.trim();

  if (!passwordInput && !isActiveCredential(existing)) {
    throw new PostgresAdminCredentialError("Informe a senha administrativa.");
  }

  const passwordEncrypted =
    passwordInput && passwordInput.length > 0
      ? encryptSecret(passwordInput)
      : existing!.passwordEncrypted;

  const upsertData = {
    host,
    port,
    maintenanceDatabase,
    username,
    passwordEncrypted,
    sslEnabled: input.sslEnabled,
    status: "ACTIVE" as const,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null
  };

  return db.postgresAdminCredential.upsert({
    where: { name: DEFAULT_CREDENTIAL_NAME },
    create: {
      name: DEFAULT_CREDENTIAL_NAME,
      ...upsertData
    },
    update: upsertData
  });
}

export async function removePostgresAdminCredential(db: DbClient = prisma) {
  const credential = await getPostgresAdminCredential(db);

  if (!credential) {
    return null;
  }

  return db.postgresAdminCredential.update({
    where: { id: credential.id },
    data: {
      passwordEncrypted: "",
      status: "DISABLED",
      lastTestStatus: null,
      lastTestMessage: null,
      lastTestedAt: null
    }
  });
}

export async function recordPostgresAdminTestResult(
  result: "success" | "failed",
  message: string,
  db: DbClient = prisma
) {
  const credential = await getPostgresAdminCredential(db);

  if (!credential) {
    return null;
  }

  return db.postgresAdminCredential.update({
    where: { id: credential.id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result,
      lastTestMessage: message,
      status: result === "success" ? "ACTIVE" : "INVALID"
    }
  });
}

export function sanitizePostgresAdminForAudit(
  credential: PostgresAdminCredential | null | Record<string, unknown>
) {
  if (!credential) {
    return { hasCredential: false };
  }

  const { passwordEncrypted, ...safe } = credential as Record<string, unknown>;

  return {
    ...safe,
    hasPassword: Boolean(passwordEncrypted)
  };
}
