import { getPostgresAdminCredential } from "@/lib/server/postgres-admin-credential";

export class DatabaseGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseGuardError";
  }
}

const PROTECTED_DATABASE_NAMES = new Set(["postgres", "minihost"]);

export const DESTROYABLE_DATABASE_STATUSES = [
  "ACTIVE",
  "FAILED",
  "CREATED_MANUALLY",
  "DISABLED"
] as const;

export function isProtectedDatabaseName(databaseName: string) {
  const normalized = databaseName.trim().toLowerCase();

  if (PROTECTED_DATABASE_NAMES.has(normalized)) {
    return true;
  }

  return normalized.startsWith("template");
}

export function isProtectedDatabaseUser(databaseUser: string, adminUsername?: string) {
  const normalized = databaseUser.trim().toLowerCase();

  if (normalized === "postgres") {
    return true;
  }

  if (adminUsername && normalized === adminUsername.trim().toLowerCase()) {
    return true;
  }

  return false;
}

export async function assertDatabaseDestructionAllowed(
  databaseName: string,
  databaseUser: string,
  status: string
) {
  if (!DESTROYABLE_DATABASE_STATUSES.includes(status as (typeof DESTROYABLE_DATABASE_STATUSES)[number])) {
    throw new DatabaseGuardError("Este banco não pode ser destruído no status atual.");
  }

  if (isProtectedDatabaseName(databaseName)) {
    throw new DatabaseGuardError(`O banco "${databaseName}" é protegido e não pode ser destruído.`);
  }

  const credential = await getPostgresAdminCredential();
  const adminUsername = credential?.username;

  if (isProtectedDatabaseUser(databaseUser, adminUsername)) {
    throw new DatabaseGuardError(`O usuário "${databaseUser}" é protegido e não pode ser removido.`);
  }
}
