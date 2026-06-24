import type { HistoryItem } from "@/lib/types";

export type AuditActionCategory =
  | "create"
  | "update"
  | "delete"
  | "sync"
  | "template"
  | "error"
  | "success"
  | "system";

export type AuditEntityFilter =
  | "all"
  | "domain"
  | "record"
  | "project"
  | "project_database"
  | "project_application"
  | "cloudflare"
  | "coolify"
  | "template"
  | "settings"
  | "system";

export type AuditActionFilter =
  | "all"
  | "create"
  | "update"
  | "delete"
  | "sync"
  | "template"
  | "error";

export type AuditUserFilter = "all" | "system" | string;

const SENSITIVE_KEYS = new Set([
  "token",
  "password",
  "secret",
  "apikey",
  "api_key",
  "api_token",
  "cloudflaretoken",
  "passwordhash"
]);

export function normalizeKey(key: string) {
  return key.replace(/[_-]/g, "").toLowerCase();
}

export function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token")
  );
}

export function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveData(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        isSensitiveKey(key) ? "••••••••" : maskSensitiveData(entryValue)
      ])
    );
  }

  return value;
}

export function getActionCategory(action: string): AuditActionCategory {
  const upper = action.toUpperCase();

  if (upper.includes("FAILED") || upper.includes("ERROR") || upper.includes("FALHA")) {
    return "error";
  }

  if (upper.includes("DELETE") || action.toLowerCase().includes("exclu")) {
    return "delete";
  }

  if (upper.includes("SYNC") || action.toLowerCase().includes("sincroniz")) {
    return "sync";
  }

  if (upper.includes("TEMPLATE") || upper.includes("FROM_TEMPLATE")) {
    return "template";
  }

  if (
    upper.includes("UPDATE") ||
    upper.includes("SETTINGS_UPDATE") ||
    action.toLowerCase().includes("editad") ||
    action.toLowerCase().includes("atualizad") ||
    action.toLowerCase().includes("salv")
  ) {
    return "update";
  }

  if (
    upper.includes("CREATE") ||
    action.toLowerCase().includes("criad") ||
    action.toLowerCase().includes("cadastrad")
  ) {
    return "create";
  }

  return "system";
}

export function getActionLabel(category: AuditActionCategory) {
  const labels: Record<AuditActionCategory, string> = {
    create: "Criação",
    update: "Atualização",
    delete: "Exclusão",
    sync: "Sincronização",
    template: "Template",
    error: "Erro",
    success: "Sucesso",
    system: "Sistema"
  };

  return labels[category];
}

export function matchesActionFilter(action: string, filter: AuditActionFilter) {
  if (filter === "all") {
    return true;
  }

  return getActionCategory(action) === filter;
}

export function getEntityFilterCategory(item: HistoryItem): AuditEntityFilter {
  const action = item.action.toUpperCase();

  if (!item.userId && !item.userName) {
    return "system";
  }

  if (action.includes("TEMPLATE") || action.includes("FROM_TEMPLATE")) {
    return "template";
  }

  if (action.includes("COOLIFY") || item.entityType === "coolify") {
    return "coolify";
  }

  if (action.includes("CLOUDFLARE") || action.includes("SYNC")) {
    return "cloudflare";
  }

  if (action.includes("POSTGRES")) {
    return "settings";
  }

  if (item.entityType === "domain") {
    return "domain";
  }

  if (item.entityType === "record") {
    return "record";
  }

  if (item.entityType === "project") {
    return "project";
  }

  if (item.entityType === "project_database") {
    return "project_database";
  }

  if (item.entityType === "project_application") {
    return "project_application";
  }

  if (item.entityType === "settings") {
    return "settings";
  }

  return "system";
}

export function matchesEntityFilter(item: HistoryItem, filter: AuditEntityFilter) {
  if (filter === "all") {
    return true;
  }

  return getEntityFilterCategory(item) === filter;
}

export function matchesUserFilter(item: HistoryItem, filter: AuditUserFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "system") {
    return !item.userId && !item.userName;
  }

  return item.userId === filter;
}

export function getRecordData(item: HistoryItem) {
  const data = (item.newData ?? item.oldData) as Record<string, unknown> | undefined;
  return data;
}

export function getEntityDisplay(item: HistoryItem) {
  const filterCategory = getEntityFilterCategory(item);
  const recordData = getRecordData(item);

  if (item.entityType === "record") {
    const match = item.entityName.match(/^(A|AAAA|CNAME|TXT|MX)\s+(.+)$/i);
    const type = (match?.[1] ?? (typeof recordData?.type === "string" ? recordData.type : undefined))?.toUpperCase();
    const rawName = match?.[2] ?? (typeof recordData?.name === "string" ? recordData.name : item.entityName);
    const domain = typeof recordData?.domain === "string" ? recordData.domain : undefined;

    let identifier = rawName;

    if (domain) {
      identifier = !rawName || rawName === "@" ? domain : rawName.endsWith(`.${domain}`) ? rawName : `${rawName}.${domain}`;
    }

    return {
      label: type ? `Registro DNS (${type})` : "Registro DNS",
      identifier
    };
  }

  if (item.entityType === "domain") {
    return {
      label: "Domínio",
      identifier: item.entityName
    };
  }

  if (item.entityType === "project") {
    return {
      label: "Projeto",
      identifier: item.entityName
    };
  }

  if (item.entityType === "project_database") {
    return {
      label: "Banco PostgreSQL",
      identifier: item.entityName
    };
  }

  if (item.entityType === "project_application") {
    return {
      label: "Aplicação",
      identifier: item.entityName
    };
  }

  if (filterCategory === "cloudflare") {
    return {
      label: "Cloudflare",
      identifier: item.entityName
    };
  }

  if (filterCategory === "coolify") {
    return {
      label: "Coolify",
      identifier: item.entityName
    };
  }

  if (filterCategory === "template") {
    return {
      label: "Template DNS",
      identifier: typeof recordData?.templateName === "string" ? recordData.templateName : item.entityName
    };
  }

  if (item.entityType === "settings") {
    return {
      label: "Configuração",
      identifier: item.entityName
    };
  }

  return {
    label: "Sistema",
    identifier: item.entityName
  };
}

export function getUserDisplay(item: HistoryItem) {
  if (item.userName) {
    return {
      name: item.userName,
      email: item.userEmail,
      isSystem: false
    };
  }

  return {
    name: "Sistema",
    email: undefined,
    isSystem: true
  };
}

function stringifySearchValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(maskSensitiveData(value));
  } catch {
    return "";
  }
}

export function matchesSearch(item: HistoryItem, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const entity = getEntityDisplay(item);
  const user = getUserDisplay(item);

  return [
    item.action,
    item.entityType,
    item.entityName,
    item.description,
    entity.label,
    entity.identifier,
    user.name,
    user.email ?? "",
    stringifySearchValue(item.oldData),
    stringifySearchValue(item.newData)
  ].some((value) => value.toLowerCase().includes(normalized));
}

export function matchesDateRange(item: HistoryItem, startDate?: string, endDate?: string) {
  if (!startDate && !endDate) {
    return true;
  }

  const timestamp = new Date(item.timestamp);

  if (Number.isNaN(timestamp.getTime())) {
    return false;
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);

    if (timestamp < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);

    if (timestamp > end) {
      return false;
    }
  }

  return true;
}

export function getUniqueUsers(history: HistoryItem[]) {
  const users = new Map<string, { id: string; name: string; email?: string }>();

  history.forEach((item) => {
    if (item.userId && item.userName) {
      users.set(item.userId, {
        id: item.userId,
        name: item.userName,
        email: item.userEmail
      });
    }
  });

  return Array.from(users.values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function exportHistoryToCsv(items: HistoryItem[]) {
  const headers = ["Ação", "Entidade", "Identificador", "Usuário", "Email", "Data/hora", "Descrição", "ID"];

  const rows = items.map((item) => {
    const entity = getEntityDisplay(item);
    const user = getUserDisplay(item);
    const category = getActionCategory(item.action);

    return [
      getActionLabel(category),
      entity.label,
      entity.identifier,
      user.name,
      user.email ?? "",
      item.timestamp,
      item.description,
      item.id
    ];
  });

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  return [headers, ...rows].map((row) => row.map((cell) => escape(String(cell))).join(",")).join("\n");
}
