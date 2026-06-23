import { randomBytes } from "crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { MiniHostSettings, ProjectDatabase } from "@/lib/types";

const MIN_PASSWORD_LENGTH = 16;

export function generateDatabasePassword(length = 24) {
  const size = Math.max(MIN_PASSWORD_LENGTH, length);
  let password = "";

  while (password.length < size) {
    password += randomBytes(size).toString("base64url");
  }

  return password.slice(0, size);
}

export function buildSuggestedDatabaseFields(
  slug: string,
  settings: Pick<
    MiniHostSettings,
    "defaultPostgresHost" | "defaultPostgresPort" | "defaultPostgresDatabaseSuffix" | "defaultPostgresUserSuffix"
  >
) {
  const normalizedSlug = slug.trim().toLowerCase().replace(/-/g, "_").replace(/[^a-z0-9_]/g, "");
  const databaseSuffix = settings.defaultPostgresDatabaseSuffix || "_db";
  const userSuffix = settings.defaultPostgresUserSuffix || "_user";
  const port = Number(settings.defaultPostgresPort || 5432);

  return {
    name: `Banco ${slug}`,
    databaseName: `${normalizedSlug}${databaseSuffix}`,
    databaseUser: `${normalizedSlug}${userSuffix}`,
    host: settings.defaultPostgresHost || "localhost",
    port: Number.isFinite(port) && port > 0 ? port : 5432
  };
}

export function buildConnectionUrl(user: string, password: string, host: string, port: number, database: string) {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}

export function buildEnvFile(user: string, password: string, host: string, port: number, database: string) {
  const url = buildConnectionUrl(user, password, host, port, database);

  return `DATABASE_URL="${url}"

POSTGRES_HOST=${host}
POSTGRES_PORT=${port}
POSTGRES_DB=${database}
POSTGRES_USER=${user}
POSTGRES_PASSWORD=${password}`;
}

export function buildManualSql(user: string, password: string, database: string) {
  const escapedPassword = password.replace(/'/g, "''");

  return `-- Revise antes de executar em produção.
CREATE ROLE ${user}
WITH LOGIN PASSWORD '${escapedPassword}'
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOREPLICATION;

CREATE DATABASE ${database} OWNER ${user};

REVOKE CONNECT ON DATABASE ${database} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${database} TO ${user};`;
}

export function encryptDatabasePassword(password: string) {
  return encryptSecret(password);
}

export function decryptDatabasePassword(encrypted: string) {
  return decryptSecret(encrypted);
}

export function sanitizeProjectDatabaseForAudit(database: Record<string, unknown> | ProjectDatabase) {
  const { databasePasswordEncrypted, connectionUrlEncrypted, generatedPassword, password, ...safe } =
    database as Record<string, unknown>;

  return {
    ...safe,
    hasPassword: true
  };
}

export function ensurePasswordLength(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function isProjectDatabaseMutableStatus(status: string) {
  return status !== "ARCHIVED" && status !== "DESTROYED" && status !== "PARTIALLY_DESTROYED";
}
