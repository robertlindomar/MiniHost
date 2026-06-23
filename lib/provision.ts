import { isDatabaseReadOnly } from "@/lib/database-danger";

export function buildProvisionConfirmationText(databaseName: string) {
  return `criar banco ${databaseName.trim().toLowerCase()}`;
}

export function buildFixPermissionsConfirmationText(databaseName: string) {
  return `corrigir permissoes ${databaseName.trim().toLowerCase()}`;
}

export function buildMaskedProvisionSql(databaseUser: string, databaseName: string) {
  return `-- Revise antes de executar em produção.
CREATE ROLE ${databaseUser}
WITH LOGIN PASSWORD '••••••••'
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOREPLICATION;

CREATE DATABASE ${databaseName} OWNER ${databaseUser};

REVOKE CONNECT ON DATABASE ${databaseName} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${databaseName} TO ${databaseUser};`;
}

export function buildMaskedFixPermissionsSql(databaseUser: string, databaseName: string) {
  return `-- Ajustes no banco do projeto
REVOKE CONNECT ON DATABASE ${databaseName} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${databaseName} TO ${databaseUser};

-- Outros bancos (exemplo)
-- REVOKE CONNECT ON DATABASE outro_banco FROM ${databaseUser};`;
}

export function canProvisionDatabase(
  status: string,
  hasAdminCredential: boolean
) {
  if (!hasAdminCredential) {
    return false;
  }

  if (status === "ACTIVE" || status === "PROVISIONING" || status === "ARCHIVED" || status === "DISABLED" || status === "DESTROYED" || status === "PARTIALLY_DESTROYED") {
    return false;
  }

  return status === "PLANNED" || status === "CREATED_MANUALLY" || status === "FAILED";
}

export function canManageDatabasePermissions(status: string, hasAdminCredential: boolean) {
  if (!hasAdminCredential || isDatabaseReadOnly(status) || status === "DISABLED") {
    return false;
  }

  return status === "ACTIVE" || status === "CREATED_MANUALLY";
}
