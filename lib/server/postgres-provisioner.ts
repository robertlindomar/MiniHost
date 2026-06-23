import { Client } from "pg";
import type { PostgresAdminCredential, ProjectDatabase } from "@prisma/client";
import { isValidPostgresIdentifier } from "@/lib/validation";
import { buildConnectionUrl, decryptDatabasePassword, encryptDatabasePassword } from "@/lib/server/project-database";
import { buildProvisionConfirmationText, buildMaskedProvisionSql } from "@/lib/provision";
import type { ProjectDatabasePermissionVerification } from "@/lib/types";
import {
  getPostgresAdminCredential,
  getPostgresAdminPassword,
  PostgresAdminCredentialError
} from "@/lib/server/postgres-admin-credential";
import { prisma } from "@/lib/prisma";

export class PostgresProvisionerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresProvisionerError";
  }
}

export type PostgresConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
};

function escapePgString(value: string) {
  return value.replace(/'/g, "''");
}

function assertValidIdentifier(name: string, label: string) {
  if (!isValidPostgresIdentifier(name)) {
    throw new PostgresProvisionerError(
      `${label} inválido. Use apenas letras minúsculas, números e underscore, iniciando com letra.`
    );
  }
}

export { buildProvisionConfirmationText, buildMaskedProvisionSql, buildFixPermissionsConfirmationText } from "@/lib/provision";

function buildCreateRoleSql(databaseUser: string, escapedPassword: string) {
  return `CREATE ROLE ${databaseUser}
WITH LOGIN PASSWORD '${escapedPassword}'
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOREPLICATION`;
}

function buildDatabaseConnectSql(databaseName: string, databaseUser: string) {
  return [
    `REVOKE CONNECT ON DATABASE ${databaseName} FROM PUBLIC`,
    `GRANT CONNECT ON DATABASE ${databaseName} TO ${databaseUser}`
  ];
}

function buildClientConfig(config: PostgresConnectionConfig) {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000
  };
}

async function withClient<T>(config: PostgresConnectionConfig, fn: (client: Client) => Promise<T>) {
  const client = new Client(buildClientConfig(config));

  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function testPostgresConnection(
  credential?: PostgresAdminCredential | null,
  passwordOverride?: string
) {
  const stored = credential ?? (await getPostgresAdminCredential());

  if (!stored || !stored.passwordEncrypted.trim()) {
    throw new PostgresAdminCredentialError(
      "Credencial administrativa PostgreSQL não configurada. Vá em Configurações para adicionar."
    );
  }

  const password = passwordOverride ?? (await getPostgresAdminPassword());

  await withClient(
    {
      host: stored.host,
      port: stored.port,
      database: stored.maintenanceDatabase,
      username: stored.username,
      password,
      sslEnabled: stored.sslEnabled
    },
    async (client) => {
      await client.query("SELECT 1");
    }
  );
}

export async function roleExists(username: string, config: PostgresConnectionConfig) {
  assertValidIdentifier(username, "Usuário");

  return withClient(config, async (client) => {
    const result = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists",
      [username]
    );

    return Boolean(result.rows[0]?.exists);
  });
}

export async function databaseExists(databaseName: string, config: PostgresConnectionConfig) {
  assertValidIdentifier(databaseName, "Database");

  return withClient(config, async (client) => {
    const result = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName]
    );

    return Boolean(result.rows[0]?.exists);
  });
}

function mapPgError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Erro inesperado ao provisionar o banco PostgreSQL.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("econnrefused") || message.includes("timeout") || message.includes("enotfound")) {
    return "Não foi possível conectar ao PostgreSQL. Verifique host, porta, usuário e senha.";
  }

  if (message.includes("password authentication failed")) {
    return "Autenticação recusada. Verifique usuário e senha da credencial administrativa.";
  }

  if (message.includes("permission denied") || message.includes("must be superuser") || message.includes("createrole")) {
    return "Permissão insuficiente. O usuário administrativo precisa de CREATEROLE e CREATEDB.";
  }

  if (message.includes("already exists")) {
    return "O banco ou usuário já existe no servidor PostgreSQL.";
  }

  return error.message || "Erro inesperado ao provisionar o banco PostgreSQL.";
}

function buildAdminConnectionForTarget(
  targetHost: string,
  targetPort: number,
  credential: PostgresAdminCredential,
  adminPassword: string
): PostgresConnectionConfig {
  return {
    host: targetHost,
    port: targetPort,
    database: credential.maintenanceDatabase,
    username: credential.username,
    password: adminPassword,
    sslEnabled: credential.sslEnabled
  };
}

async function getAdminConnectionForProjectDatabase(
  database: Pick<ProjectDatabase, "host" | "port">
): Promise<PostgresConnectionConfig> {
  const credential = await getPostgresAdminCredential();

  if (!credential || !credential.passwordEncrypted.trim()) {
    throw new PostgresProvisionerError(
      "Credencial administrativa PostgreSQL não configurada. Configure em Configurações."
    );
  }

  let adminPassword: string;

  try {
    adminPassword = await getPostgresAdminPassword();
  } catch (error) {
    if (error instanceof PostgresAdminCredentialError) {
      throw new PostgresProvisionerError(error.message);
    }

    throw error;
  }

  return buildAdminConnectionForTarget(database.host, database.port, credential, adminPassword);
}

async function listNonTemplateDatabaseNames(client: Client) {
  return client.query<{ datname: string }>(
    `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
  );
}

function buildPermissionVerification(
  databaseName: string,
  databaseUser: string,
  rows: Array<{ datname: string; user_can_connect: boolean; public_can_connect: boolean }>
): ProjectDatabasePermissionVerification {
  const details = rows.map((row) => ({
    databaseName: row.datname,
    canConnect: row.user_can_connect,
    isProjectDatabase: row.datname === databaseName,
    publicCanConnect: row.public_can_connect
  }));

  const connectableDatabases = details.filter((row) => row.canConnect).map((row) => row.databaseName);
  const unexpectedDatabases = connectableDatabases.filter((name) => name !== databaseName);
  const publicConnectWarnings = unexpectedDatabases
    .filter((name) => details.find((row) => row.databaseName === name)?.publicCanConnect)
    .map((name) => `O banco "${name}" ainda permite CONNECT para PUBLIC.`);

  const ok =
    unexpectedDatabases.length === 0 && connectableDatabases.includes(databaseName);

  return {
    ok,
    projectDatabaseName: databaseName,
    projectUser: databaseUser,
    connectableDatabases,
    unexpectedDatabases,
    publicConnectWarnings,
    details
  };
}

export async function verifyProjectDatabasePermissions(projectDatabaseId: string) {
  const database = await prisma.projectDatabase.findUnique({
    where: { id: projectDatabaseId }
  });

  if (!database) {
    throw new PostgresProvisionerError("Banco não encontrado.");
  }

  if (database.status !== "ACTIVE" && database.status !== "CREATED_MANUALLY") {
    throw new PostgresProvisionerError("Permissões só podem ser verificadas em bancos ativos ou criados manualmente.");
  }

  assertValidIdentifier(database.databaseName, "Nome do database");
  assertValidIdentifier(database.databaseUser, "Usuário do database");

  const connectionConfig = await getAdminConnectionForProjectDatabase(database);

  return withClient(connectionConfig, async (client) => {
    const result = await client.query<{ datname: string; user_can_connect: boolean; public_can_connect: boolean }>(
      `SELECT
        datname,
        has_database_privilege($1, datname, 'CONNECT') AS user_can_connect,
        has_database_privilege('PUBLIC', datname, 'CONNECT') AS public_can_connect
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname`,
      [database.databaseUser]
    );

    return buildPermissionVerification(database.databaseName, database.databaseUser, result.rows);
  });
}

export async function fixProjectDatabasePermissions(projectDatabaseId: string) {
  const database = await prisma.projectDatabase.findUnique({
    where: { id: projectDatabaseId }
  });

  if (!database) {
    throw new PostgresProvisionerError("Banco não encontrado.");
  }

  if (database.status !== "ACTIVE" && database.status !== "CREATED_MANUALLY") {
    throw new PostgresProvisionerError("Permissões só podem ser corrigidas em bancos ativos ou criados manualmente.");
  }

  assertValidIdentifier(database.databaseName, "Nome do database");
  assertValidIdentifier(database.databaseUser, "Usuário do database");

  const connectionConfig = await getAdminConnectionForProjectDatabase(database);

  await withClient(connectionConfig, async (client) => {
    const databases = await listNonTemplateDatabaseNames(client);

    for (const row of databases.rows) {
      if (row.datname === database.databaseName) {
        for (const sql of buildDatabaseConnectSql(database.databaseName, database.databaseUser)) {
          await client.query(sql);
        }
        continue;
      }

      await client.query(`REVOKE CONNECT ON DATABASE ${row.datname} FROM ${database.databaseUser}`);
    }
  });

  return verifyProjectDatabasePermissions(projectDatabaseId);
}

export async function createProjectDatabase(projectDatabaseId: string, userId: string) {
  const database = await prisma.projectDatabase.findUnique({
    where: { id: projectDatabaseId },
    include: { project: true }
  });

  if (!database) {
    throw new PostgresProvisionerError("Banco planejado não encontrado.");
  }

  if (database.status !== "PLANNED" && database.status !== "CREATED_MANUALLY" && database.status !== "FAILED") {
    throw new PostgresProvisionerError("Este banco não pode ser provisionado no status atual.");
  }

  if (!database.databasePasswordEncrypted) {
    throw new PostgresProvisionerError("Senha do banco planejado ausente. Gere uma senha antes de provisionar.");
  }

  assertValidIdentifier(database.databaseName, "Nome do database");
  assertValidIdentifier(database.databaseUser, "Usuário do database");

  const credential = await getPostgresAdminCredential();

  if (!credential || !credential.passwordEncrypted.trim()) {
    throw new PostgresProvisionerError(
      "Credencial administrativa PostgreSQL não configurada. Configure em Configurações."
    );
  }

  let adminPassword: string;

  try {
    adminPassword = await getPostgresAdminPassword();
  } catch (error) {
    if (error instanceof PostgresAdminCredentialError) {
      throw new PostgresProvisionerError(error.message);
    }

    throw error;
  }

  let dbPassword: string;

  try {
    dbPassword = decryptDatabasePassword(database.databasePasswordEncrypted);
  } catch {
    throw new PostgresProvisionerError("Não foi possível ler a senha do banco planejado.");
  }

  const connectionConfig = await buildAdminConnectionForTarget(
    database.host,
    database.port,
    credential,
    adminPassword
  );

  const userExists = await roleExists(database.databaseUser, connectionConfig);

  if (userExists) {
    throw new PostgresProvisionerError(
      `O usuário "${database.databaseUser}" já existe no servidor. Corrija manualmente ou escolha outro usuário.`
    );
  }

  const dbExists = await databaseExists(database.databaseName, connectionConfig);

  if (dbExists) {
    throw new PostgresProvisionerError(
      `O banco "${database.databaseName}" já existe no servidor. Corrija manualmente ou escolha outro nome.`
    );
  }

  await prisma.projectDatabase.update({
    where: { id: database.id },
    data: {
      status: "PROVISIONING",
      lastProvisionError: null
    }
  });

  const escapedPassword = escapePgString(dbPassword);
  const createRoleSql = buildCreateRoleSql(database.databaseUser, escapedPassword);
  const createDatabaseSql = `CREATE DATABASE ${database.databaseName} OWNER ${database.databaseUser}`;

  try {
    await withClient(connectionConfig, async (client) => {
      await client.query(createRoleSql);
    });
  } catch (error) {
    const message = mapPgError(error);

    await prisma.projectDatabase.update({
      where: { id: database.id },
      data: {
        status: "FAILED",
        lastProvisionError: message
      }
    });

    throw new PostgresProvisionerError(message);
  }

  try {
    await withClient(connectionConfig, async (client) => {
      await client.query(createDatabaseSql);

      for (const sql of buildDatabaseConnectSql(database.databaseName, database.databaseUser)) {
        await client.query(sql);
      }
    });
  } catch (error) {
    const message = `${mapPgError(error)} O usuário "${database.databaseUser}" pode ter sido criado — revise manualmente antes de tentar novamente.`;

    await prisma.projectDatabase.update({
      where: { id: database.id },
      data: {
        status: "FAILED",
        lastProvisionError: message
      }
    });

    throw new PostgresProvisionerError(message);
  }

  const connectionUrl = buildConnectionUrl(
    database.databaseUser,
    dbPassword,
    database.host,
    database.port,
    database.databaseName
  );

  const updated = await prisma.projectDatabase.update({
    where: { id: database.id },
    data: {
      status: "ACTIVE",
      connectionUrlEncrypted: encryptDatabasePassword(connectionUrl),
      provisionedAt: new Date(),
      provisionedBy: userId,
      lastProvisionError: null
    },
    include: { project: true }
  });

  return updated;
}

export async function getProvisionPreview(projectDatabase: Pick<ProjectDatabase, "databaseName" | "databaseUser" | "host" | "port">) {
  assertValidIdentifier(projectDatabase.databaseName, "Nome do database");
  assertValidIdentifier(projectDatabase.databaseUser, "Usuário do database");

  return {
    databaseName: projectDatabase.databaseName,
    databaseUser: projectDatabase.databaseUser,
    host: projectDatabase.host,
    port: projectDatabase.port,
    confirmationText: buildProvisionConfirmationText(projectDatabase.databaseName),
    maskedSql: buildMaskedProvisionSql(projectDatabase.databaseUser, projectDatabase.databaseName)
  };
}
