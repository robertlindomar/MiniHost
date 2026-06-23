export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
  comment?: string | null;
  created_on?: string;
  modified_on?: string;
}

export interface CloudflareCreateDnsRecordPayload {
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
  comment?: string | null;
}

interface CloudflareListResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: CloudflareDnsRecord[];
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    count: number;
    total_count: number;
  };
}

interface CloudflareSingleRecordResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: CloudflareDnsRecord;
}

export class CloudflareApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = status;
  }
}

function getApiToken() {
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!token) {
    throw new CloudflareApiError("Token da Cloudflare ausente.");
  }

  return token;
}

function getErrorMessage(status: number, payload?: { errors?: Array<{ code: number; message: string }> }) {
  if (status === 401) {
    return "Token da Cloudflare inválido.";
  }

  if (status === 403) {
    return "Zone ID inválido ou token sem permissão para ler DNS desta zona.";
  }

  if (status >= 500) {
    return "Cloudflare indisponível no momento.";
  }

  return payload?.errors?.[0]?.message || "Resposta inesperada da Cloudflare.";
}

export async function listDnsRecords(zoneId: string) {
  const token = getApiToken();
  const records: CloudflareDnsRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });
    } catch {
      throw new CloudflareApiError("Não foi possível conectar à Cloudflare.");
    }

    const payload = (await response.json().catch(() => null)) as CloudflareListResponse | null;

    if (!response.ok || !payload?.success) {
      throw new CloudflareApiError(getErrorMessage(response.status, payload ?? undefined), response.status);
    }

    if (!Array.isArray(payload.result)) {
      throw new CloudflareApiError("Resposta inesperada da Cloudflare.");
    }

    records.push(...payload.result);
    totalPages = payload.result_info?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return records;
}

export async function createDnsRecord(zoneId: string, payload: CloudflareCreateDnsRecordPayload) {
  const token = getApiToken();
  const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  } catch {
    throw new CloudflareApiError("Não foi possível conectar à Cloudflare.");
  }

  const responsePayload = (await response.json().catch(() => null)) as CloudflareSingleRecordResponse | null;

  if (!response.ok || !responsePayload?.success) {
    throw new CloudflareApiError(getErrorMessage(response.status, responsePayload ?? undefined), response.status);
  }

  if (!responsePayload.result?.id) {
    throw new CloudflareApiError("Resposta inesperada da Cloudflare.");
  }

  return responsePayload.result;
}
