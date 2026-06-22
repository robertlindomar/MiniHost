import type { DnsRecord, Domain, HistoryItem, MiniHostSettings } from "@/lib/types";

const STORAGE_KEYS = {
  initialized: "minihost:initialized",
  domains: "minihost:domains",
  records: "minihost:dns-records",
  history: "minihost:history",
  settings: "minihost:settings"
};

const defaultDomainId = "domain-robertlindomar-dev";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getInitialSettings(): MiniHostSettings {
  return {
    cloudflareApiToken: "",
    defaultZoneId: "fake-zone-robertlindomar",
    defaultDomain: "robertlindomar.dev",
    defaultVpsIp: "72.60.250.39",
    defaultProxyEnabled: true
  };
}

function buildInitialData() {
  const now = new Date().toISOString();

  const domains: Domain[] = [
    {
      id: defaultDomainId,
      name: "robertlindomar.dev",
      provider: "Cloudflare",
      zoneId: "fake-zone-robertlindomar",
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ];

  const records: DnsRecord[] = [
    {
      id: "record-root-a",
      domainId: defaultDomainId,
      type: "A",
      name: "@",
      value: "72.60.250.39",
      ttl: "auto",
      proxied: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
      comment: "Entrada principal da VPS"
    },
    {
      id: "record-panel-a",
      domainId: defaultDomainId,
      type: "A",
      name: "painel",
      value: "72.60.250.39",
      ttl: "auto",
      proxied: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
      comment: "Painel administrativo"
    },
    {
      id: "record-www-cname",
      domainId: defaultDomainId,
      type: "CNAME",
      name: "www",
      value: "robertlindomar.dev",
      ttl: "auto",
      proxied: true,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "record-verify-txt",
      domainId: defaultDomainId,
      type: "TXT",
      name: "_verify",
      value: "minihost-verification=fake-token",
      ttl: 3600,
      proxied: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
      comment: "Verificação simulada"
    }
  ];

  const history: HistoryItem[] = [
    {
      id: "history-domain-created",
      action: "Domínio criado",
      entityType: "domain",
      entityName: "robertlindomar.dev",
      timestamp: now,
      description: "Domínio inicial criado para simular o ambiente local."
    },
    {
      id: "history-record-created-root",
      action: "Registro criado",
      entityType: "record",
      entityName: "A @",
      timestamp: now,
      description: "Registro A inicial apontando para 72.60.250.39."
    },
    {
      id: "history-record-created-panel",
      action: "Registro criado",
      entityType: "record",
      entityName: "A painel",
      timestamp: now,
      description: "Registro A inicial para o subdomínio painel."
    },
    {
      id: "history-record-created-www",
      action: "Registro criado",
      entityType: "record",
      entityName: "CNAME www",
      timestamp: now,
      description: "Registro CNAME inicial para www."
    },
    {
      id: "history-record-created-txt",
      action: "Registro criado",
      entityType: "record",
      entityName: "TXT _verify",
      timestamp: now,
      description: "Registro TXT fake para verificação local."
    }
  ];

  return { domains, records, history };
}

export function initializeMiniHostStorage() {
  if (!canUseStorage()) {
    return;
  }

  const { domains, records, history } = buildInitialData();

  if (!window.localStorage.getItem(STORAGE_KEYS.domains)) {
    writeJson(STORAGE_KEYS.domains, domains);
  }

  if (!window.localStorage.getItem(STORAGE_KEYS.records)) {
    writeJson(STORAGE_KEYS.records, records);
  }

  if (!window.localStorage.getItem(STORAGE_KEYS.history)) {
    writeJson(STORAGE_KEYS.history, history);
  }

  if (!window.localStorage.getItem(STORAGE_KEYS.settings)) {
    writeJson(STORAGE_KEYS.settings, getInitialSettings());
  }

  window.localStorage.setItem(STORAGE_KEYS.initialized, "true");
}

export function loadDomains() {
  return readJson<Domain[]>(STORAGE_KEYS.domains, []);
}

export function saveDomains(domains: Domain[]) {
  writeJson(STORAGE_KEYS.domains, domains);
}

export function loadRecords() {
  return readJson<DnsRecord[]>(STORAGE_KEYS.records, []);
}

export function saveRecords(records: DnsRecord[]) {
  writeJson(STORAGE_KEYS.records, records);
}

export function loadHistory() {
  return readJson<HistoryItem[]>(STORAGE_KEYS.history, []);
}

export function saveHistory(history: HistoryItem[]) {
  writeJson(STORAGE_KEYS.history, history);
}

export function addHistoryItem(item: Omit<HistoryItem, "id" | "timestamp"> & { timestamp?: string }) {
  const history = loadHistory();
  const nextItem: HistoryItem = {
    ...item,
    id: createId("history"),
    timestamp: item.timestamp ?? new Date().toISOString()
  };

  saveHistory([nextItem, ...history]);
  return nextItem;
}

export function loadSettings() {
  return readJson<MiniHostSettings>(STORAGE_KEYS.settings, getInitialSettings());
}

export function saveSettings(settings: MiniHostSettings) {
  writeJson(STORAGE_KEYS.settings, settings);
}
