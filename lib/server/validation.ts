import type {
  DnsRecordFormInput,
  DomainFormInput,
  MiniHostSettings,
  ProjectDatabaseFormInput,
  ProjectFormInput
} from "@/lib/types";
import { validateSettingsInput } from "@/lib/settings";
import { ensurePasswordLength } from "@/lib/server/project-database";
import {
  isDomainLike,
  isPlausibleZoneId,
  isValidPostgresIdentifier,
  isValidProjectSlug,
  validateRecordInput
} from "@/lib/validation";

export function validateDomainInput(input: DomainFormInput) {
  const errors: string[] = [];
  const name = input.name?.trim().toLowerCase();
  const provider = input.provider?.trim();

  if (!name) {
    errors.push("Informe o nome do domínio.");
  }

  if (name && /\s/.test(name)) {
    errors.push("Nome do domínio não pode ter espaço.");
  }

  if (name && /^https?:\/\//i.test(name)) {
    errors.push("Informe apenas o domínio, sem http:// ou https://.");
  }

  if (name && !isDomainLike(name)) {
    errors.push("Informe um domínio válido, como exemplo.com.");
  }

  if (!provider) {
    errors.push("Informe o provedor.");
  }

  if (input.status !== "active" && input.status !== "inactive") {
    errors.push("Status inválido.");
  }

  if (input.zoneId && !isPlausibleZoneId(input.zoneId)) {
    errors.push("Zone ID deve ter um formato plausível.");
  }

  return {
    errors,
    data: {
      name,
      provider,
      zoneId: input.zoneId?.trim() || null,
      status: input.status === "inactive" ? "inactive" : "active"
    }
  };
}

export function validateSettingsBody(input: Partial<MiniHostSettings>) {
  const { errors, data } = validateSettingsInput(input);
  const errorList = Object.values(errors);

  return {
    errors: errorList,
    fieldErrors: errors,
    data
  };
}

export function validateDnsRecordBody(input: DnsRecordFormInput) {
  const errors = validateRecordInput(input);

  if (!["A", "AAAA", "CNAME", "TXT", "MX"].includes(input.type)) {
    errors.push("Tipo de registro inválido.");
  }

  const proxied = input.type === "TXT" || input.type === "MX" ? false : Boolean(input.proxied);

  return {
    errors,
    data: {
      domainId: input.domainId,
      projectId: input.projectId?.trim() || null,
      type: input.type,
      name: input.name.trim(),
      content: input.value.trim(),
      ttl: input.ttl === "auto" || input.ttl === 1 ? null : Number(input.ttl),
      proxied,
      status: input.status === "inactive" ? "inactive" : "active",
      comment: input.comment?.trim() || null,
      priority: input.type === "MX" ? Number(input.priority) : null
    }
  };
}

export function validateProjectInput(input: ProjectFormInput) {
  const errors: string[] = [];
  const name = input.name?.trim();
  const slug = input.slug?.trim().toLowerCase();
  const description = input.description?.trim() || null;
  const mainDomain = input.mainDomain?.trim().toLowerCase() || null;
  const validStatuses = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

  if (!name) {
    errors.push("Informe o nome do projeto.");
  }

  if (!slug) {
    errors.push("Informe o slug do projeto.");
  }

  if (slug && !isValidProjectSlug(slug)) {
    errors.push("Slug deve conter apenas letras minúsculas, números e hífen.");
  }

  if (mainDomain && !isDomainLike(mainDomain)) {
    errors.push("Domínio principal deve parecer um domínio válido.");
  }

  if (!validStatuses.includes(input.status)) {
    errors.push("Status do projeto inválido.");
  }

  return {
    errors,
    data: {
      name,
      slug,
      description,
      status: input.status,
      mainDomain
    }
  };
}

export function validateProjectDatabaseInput(input: ProjectDatabaseFormInput) {
  const errors: string[] = [];
  const name = input.name?.trim();
  const databaseName = input.databaseName?.trim().toLowerCase();
  const databaseUser = input.databaseUser?.trim().toLowerCase();
  const host = input.host?.trim();
  const port = Number(input.port);
  const notes = input.notes?.trim() || null;
  const validStatuses = ["PLANNED", "CREATED_MANUALLY", "ACTIVE", "DISABLED", "ARCHIVED"] as const;
  const status = input.status ?? "PLANNED";

  if (!name) {
    errors.push("Informe o nome interno do banco.");
  }

  if (!databaseName) {
    errors.push("Informe o database name.");
  }

  if (databaseName && !isValidPostgresIdentifier(databaseName)) {
    errors.push("Database name deve conter apenas letras minúsculas, números e underscore, começando com letra.");
  }

  if (!databaseUser) {
    errors.push("Informe o usuário do banco.");
  }

  if (databaseUser && !isValidPostgresIdentifier(databaseUser)) {
    errors.push("Database user deve conter apenas letras minúsculas, números e underscore, começando com letra.");
  }

  if (!host) {
    errors.push("Informe o host do PostgreSQL.");
  }

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    errors.push("Porta deve estar entre 1 e 65535.");
  }

  if (!validStatuses.includes(status)) {
    errors.push("Status do banco inválido.");
  }

  const generatePassword = Boolean(input.generatePassword);
  const password = input.password?.trim() ?? "";

  if (!generatePassword) {
    if (!password) {
      errors.push("Informe a senha ou marque gerar automaticamente.");
    } else if (!ensurePasswordLength(password)) {
      errors.push("Senha deve ter pelo menos 16 caracteres.");
    }
  }

  return {
    errors,
    data: {
      name,
      databaseName,
      databaseUser,
      host,
      port,
      notes,
      status,
    generatePassword,
    password: generatePassword ? null : password
    }
  };
}

export function validateProjectDatabaseUpdateInput(input: {
  name: string;
  databaseName: string;
  databaseUser: string;
  host: string;
  port: number;
  status: ProjectDatabaseFormInput["status"];
  notes?: string | null;
}) {
  const errors: string[] = [];
  const validStatuses = ["PLANNED", "CREATED_MANUALLY", "ACTIVE", "DISABLED", "ARCHIVED"] as const;

  if (!input.name?.trim()) {
    errors.push("Informe o nome interno do banco.");
  }

  if (!input.databaseName?.trim()) {
    errors.push("Informe o database name.");
  } else if (!isValidPostgresIdentifier(input.databaseName)) {
    errors.push("Database name inválido.");
  }

  if (!input.databaseUser?.trim()) {
    errors.push("Informe o usuário do banco.");
  } else if (!isValidPostgresIdentifier(input.databaseUser)) {
    errors.push("Database user inválido.");
  }

  if (!input.host?.trim()) {
    errors.push("Informe o host do PostgreSQL.");
  }

  if (!Number.isFinite(input.port) || input.port < 1 || input.port > 65535) {
    errors.push("Porta deve estar entre 1 e 65535.");
  }

  if (!input.status || !validStatuses.includes(input.status)) {
    errors.push("Status do banco inválido.");
  }

  return {
    errors,
    data: {
      name: input.name.trim(),
      databaseName: input.databaseName.trim().toLowerCase(),
      databaseUser: input.databaseUser.trim().toLowerCase(),
      host: input.host.trim(),
      port: input.port,
      notes: input.notes?.trim() || null,
      status: input.status
    }
  };
}
