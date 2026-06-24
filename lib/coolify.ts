import { getCoolifyCredentialForApi } from "@/lib/server/coolify-credential";

export type CoolifyRawResource = Record<string, unknown>;

export class CoolifyApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "CoolifyApiError";
    this.status = status;
  }
}

function extractMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const message = record.message ?? record.error;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return null;
}

function getFriendlyError(status: number, payload: unknown) {
  const apiMessage = extractMessage(payload);

  if (status === 401) {
    return "Token do Coolify inválido.";
  }

  if (status === 403) {
    return "Token do Coolify sem permissão para listar recursos.";
  }

  if (status === 404) {
    return "Endpoint da API do Coolify não encontrado. Verifique a URL base informada.";
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

async function coolifyRequest(path: string) {
  const credential = await getCoolifyCredentialForApi();
  const url = buildApiUrl(credential.baseUrl, path);

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credential.token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });
  } catch {
    throw new CoolifyApiError("Não foi possível conectar ao Coolify.");
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new CoolifyApiError(getFriendlyError(response.status, payload), response.status);
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
