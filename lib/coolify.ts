import { getCoolifyCredentialForApi } from "@/lib/server/coolify-credential";

export type CoolifyRawResource = Record<string, unknown>;

export type CoolifyBuildPack = "nixpacks" | "static" | "dockerfile" | "dockercompose";

export type CreatePublicRepositoryApplicationPayload = {
  project_uuid: string;
  server_uuid: string;
  environment_name?: string;
  environment_uuid?: string;
  git_repository: string;
  git_branch: string;
  build_pack: CoolifyBuildPack;
  ports_exposes: string;
  name?: string;
  description?: string;
  domains?: string;
  install_command?: string;
  build_command?: string;
  start_command?: string;
  base_directory?: string;
  publish_directory?: string;
  instant_deploy?: boolean;
  is_auto_deploy_enabled?: boolean;
  is_static?: boolean;
};

export type CreatedCoolifyApplication = {
  uuid: string;
  status?: string;
  fqdn?: string;
  name?: string;
};

export class CoolifyApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "CoolifyApiError";
    this.status = status;
    this.details = details;
  }
}

function extractValidationErrors(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const errors = record.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return null;
      })
      .filter((item): item is string => Boolean(item))
      .join(" ");
  }

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    return Object.entries(errors as Record<string, unknown>)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) {
          return value.map((message) => `${field}: ${String(message)}`);
        }

        if (typeof value === "string") {
          return [`${field}: ${value}`];
        }

        return [];
      })
      .join(" ");
  }

  return null;
}

function extractMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const validationErrors = extractValidationErrors(payload);

  if (validationErrors) {
    return validationErrors;
  }

  const message = record.message ?? record.error;

  if (typeof message === "string" && message.trim() && message.trim().toLowerCase() !== "validation failed.") {
    return message;
  }

  if (Array.isArray(record.errors) && record.errors.length > 0) {
    const first = record.errors[0];

    if (typeof first === "string") {
      return first;
    }

    if (first && typeof first === "object" && "message" in first && typeof first.message === "string") {
      return first.message;
    }
  }

  return null;
}

function getFriendlyError(status: number, payload: unknown) {
  const apiMessage = extractMessage(payload);

  if (status === 401) {
    return "Token do Coolify inválido.";
  }

  if (status === 403) {
    return "Token do Coolify sem permissão para esta operação.";
  }

  if (status === 404) {
    return "Endpoint da API do Coolify não encontrado. Verifique a URL base informada.";
  }

  if (status === 409) {
    return apiMessage ?? "Conflito ao criar aplicação no Coolify. Verifique domínio ou nome.";
  }

  if (status === 422) {
    if (apiMessage?.includes("Invalid URL")) {
      return "Domínio inválido para o Coolify. Use uma URL completa, por exemplo: https://app.exemplo.com.";
    }

    if (apiMessage?.includes("publish_directory")) {
      return "Diretório de publicação inválido. No Coolify use um caminho começando com /, por exemplo: /dist ou /.next.";
    }

    return apiMessage ?? "Dados inválidos para criar a aplicação no Coolify.";
  }

  if (status === 400) {
    return apiMessage ?? "Requisição inválida para o Coolify.";
  }

  if (status >= 500) {
    return "Coolify indisponível no momento.";
  }

  return apiMessage ?? "Resposta inesperada do Coolify.";
}

function buildApiUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`/api/v1${normalizedPath}`, baseUrl);
}

function isRecord(value: unknown): value is CoolifyRawResource {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractArray(payload: unknown, preferredKey: string): CoolifyRawResource[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const direct = payload[preferredKey];

  if (Array.isArray(direct)) {
    return direct.filter(isRecord);
  }

  const data = payload.data;

  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (isRecord(data) && Array.isArray(data[preferredKey])) {
    return data[preferredKey].filter(isRecord);
  }

  const result = payload.result;

  if (Array.isArray(result)) {
    return result.filter(isRecord);
  }

  return [];
}

function readString(resource: CoolifyRawResource, keys: string[]) {
  for (const key of keys) {
    const value = resource[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function parseCreatedApplication(payload: unknown): CreatedCoolifyApplication {
  if (!isRecord(payload)) {
    throw new CoolifyApiError("Resposta inválida ao criar aplicação no Coolify.");
  }

  const uuid = readString(payload, ["uuid", "id", "application_uuid"]);

  if (!uuid) {
    throw new CoolifyApiError("Coolify não retornou o identificador da aplicação criada.");
  }

  return {
    uuid,
    status: readString(payload, ["status", "application_status", "applicationStatus"]) ?? undefined,
    fqdn: readString(payload, ["fqdn", "domains"]) ?? undefined,
    name: readString(payload, ["name"]) ?? undefined
  };
}

async function coolifyRequest(path: string, init: RequestInit = {}) {
  const credential = await getCoolifyCredentialForApi();
  const url = buildApiUrl(credential.baseUrl, path);
  const method = init.method ?? "GET";

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      method,
      headers: {
        Authorization: `Bearer ${credential.token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {})
      },
      cache: "no-store"
    });
  } catch {
    throw new CoolifyApiError("Não foi possível conectar ao Coolify.");
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new CoolifyApiError(getFriendlyError(response.status, payload), response.status, payload);
  }

  return payload;
}

export async function testCoolifyConnection() {
  await coolifyRequest("/servers");
  return true;
}

export async function listCoolifyServers() {
  const payload = await coolifyRequest("/servers");
  return extractArray(payload, "servers");
}

export async function listCoolifyProjects() {
  const payload = await coolifyRequest("/projects");
  return extractArray(payload, "projects");
}

export async function listCoolifyApplications() {
  const payload = await coolifyRequest("/applications");
  return extractArray(payload, "applications");
}

export async function createPublicRepositoryApplication(payload: CreatePublicRepositoryApplicationPayload) {
  const response = await coolifyRequest("/applications/public", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return parseCreatedApplication(response);
}

export type CoolifyApplicationEnvInput = {
  key: string;
  value: string;
};

export async function updateApplicationEnvs(applicationUuid: string, envs: CoolifyApplicationEnvInput[]) {
  if (envs.length === 0) {
    return { applied: false, count: 0 };
  }

  const data = envs.map((env) => ({
    key: env.key,
    value: env.value,
    is_preview: false,
    is_literal: true,
    is_multiline: false,
    is_shown_once: false,
    is_runtime: true,
    is_buildtime: true
  }));

  await coolifyRequest(`/applications/${applicationUuid}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({ data })
  });

  return { applied: true, count: envs.length };
}

export async function deployApplication(applicationUuid: string) {
  await coolifyRequest(`/deploy?uuid=${encodeURIComponent(applicationUuid)}`, {
    method: "GET"
  });

  return { queued: true };
}

export async function getCoolifyApplication(applicationUuid: string) {
  const payload = await coolifyRequest(`/applications/${applicationUuid}`);

  if (!isRecord(payload)) {
    return null;
  }

  return {
    uuid: readString(payload, ["uuid", "id"]) ?? applicationUuid,
    status: readString(payload, ["status", "status_text", "application_status"]) ?? undefined,
    fqdn: readString(payload, ["fqdn", "domains"]) ?? undefined,
    name: readString(payload, ["name"]) ?? undefined
  };
}
