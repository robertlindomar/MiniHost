"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Code2,
  Globe2,
  PanelTop,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  TextCursorInput
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import type { DnsRecord, DnsRecordFormInput, DnsRecordType, Domain, MiniHostSettings } from "@/lib/types";

type TemplateKind = "default-ip" | "root-domain" | "custom";

interface DnsTemplate {
  id: string;
  name: string;
  shortName: string;
  description: string;
  type: DnsRecordType;
  suggestedName: string;
  contentKind: TemplateKind;
  proxied: boolean;
  requiresDefaultIp?: boolean;
  recommended?: boolean;
  icon: typeof Server;
}

type DomainsResponse = { domains: Domain[] };
type SettingsResponse = {
  settings: MiniHostSettings;
  cloudflare?: { hasToken: boolean };
  cloudflareConfigured?: boolean;
};
type CreateRecordResponse = { record: DnsRecord; message?: string };

const templates: DnsTemplate[] = [
  {
    id: "vps-subdomain",
    name: "Subdomínio para VPS",
    shortName: "Novo Subdomínio",
    description: "Cria um subdomínio apontando para o IP padrão da sua VPS.",
    type: "A",
    suggestedName: "",
    contentKind: "default-ip",
    proxied: true,
    requiresDefaultIp: true,
    recommended: true,
    icon: Server
  },
  {
    id: "api",
    name: "API",
    shortName: "Novo API",
    description: "Cria um subdomínio para sua API ou backend.",
    type: "A",
    suggestedName: "api",
    contentKind: "default-ip",
    proxied: true,
    requiresDefaultIp: true,
    recommended: true,
    icon: Code2
  },
  {
    id: "panel",
    name: "Painel/Admin",
    shortName: "Novo Painel",
    description: "Cria um subdomínio para acesso ao painel ou área administrativa.",
    type: "A",
    suggestedName: "painel",
    contentKind: "default-ip",
    proxied: true,
    requiresDefaultIp: true,
    icon: PanelTop
  },
  {
    id: "app",
    name: "App/Frontend",
    shortName: "Novo App",
    description: "Cria um subdomínio para sua aplicação ou frontend.",
    type: "A",
    suggestedName: "app",
    contentKind: "default-ip",
    proxied: true,
    requiresDefaultIp: true,
    icon: Globe2
  },
  {
    id: "www-root",
    name: "www para domínio raiz",
    shortName: "Novo www",
    description: "Aponta www para o domínio raiz.",
    type: "CNAME",
    suggestedName: "www",
    contentKind: "root-domain",
    proxied: true,
    icon: ShieldCheck
  },
  {
    id: "txt-verification",
    name: "Verificação TXT",
    shortName: "Novo TXT",
    description: "Cria um registro TXT para verificação de domínio, como Google, Microsoft ou outros serviços.",
    type: "TXT",
    suggestedName: "",
    contentKind: "custom",
    proxied: false,
    icon: TextCursorInput
  },
  {
    id: "vps-subdomain-no-proxy",
    name: "Subdomínio sem proxy",
    shortName: "Sem Proxy",
    description: "Cria um subdomínio apontando para um IP com proxy desativado, apenas DNS.",
    type: "A",
    suggestedName: "",
    contentKind: "default-ip",
    proxied: false,
    requiresDefaultIp: true,
    icon: Server
  }
];

const quickTemplateOrder = ["api", "panel", "app", "vps-subdomain"];

const quickTemplateStyles: Record<string, { icon: string; text: string; border: string }> = {
  api: {
    icon: "border-blue-100 bg-blue-50 text-blue-600",
    text: "text-blue-700",
    border: "hover:border-blue-200 hover:bg-blue-50/40"
  },
  panel: {
    icon: "border-violet-100 bg-violet-50 text-violet-600",
    text: "text-violet-700",
    border: "hover:border-violet-200 hover:bg-violet-50/40"
  },
  app: {
    icon: "border-emerald-100 bg-emerald-50 text-emerald-600",
    text: "text-emerald-700",
    border: "hover:border-emerald-200 hover:bg-emerald-50/40"
  },
  "vps-subdomain": {
    icon: "border-amber-100 bg-amber-50 text-amber-600",
    text: "text-amber-700",
    border: "hover:border-amber-200 hover:bg-amber-50/40"
  }
};

const typeClasses: Record<DnsRecordType, string> = {
  A: "border-blue-100 bg-blue-50 text-blue-700",
  AAAA: "border-violet-100 bg-violet-50 text-violet-700",
  CNAME: "border-emerald-100 bg-emerald-50 text-emerald-700",
  TXT: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700",
  MX: "border-orange-100 bg-orange-50 text-orange-700"
};

function getInitialDomainId(domains: Domain[], settings: MiniHostSettings | null) {
  if (settings?.defaultDomain) {
    const defaultDomain = domains.find((domain) => domain.name === settings.defaultDomain);

    if (defaultDomain) {
      return defaultDomain.id;
    }
  }

  return domains[0]?.id ?? "";
}

function getTemplateValue(template: DnsTemplate, domain: Domain | undefined, settings: MiniHostSettings | null) {
  if (template.contentKind === "default-ip") {
    return settings?.defaultVpsIp ?? "";
  }

  if (template.contentKind === "root-domain") {
    return settings?.defaultDomain || domain?.name || "";
  }

  return "";
}

function formatRecordPreviewName(name: string, domain: Domain | undefined) {
  const normalizedName = name.trim();

  if (!domain) {
    return normalizedName || "—";
  }

  if (!normalizedName || normalizedName === "@") {
    return domain.name;
  }

  if (normalizedName.endsWith(`.${domain.name}`)) {
    return normalizedName;
  }

  return `${normalizedName}.${domain.name}`;
}

function TemplateTypeBadge({ type }: { type: DnsRecordType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClasses[type]}`}>
      {type}
    </span>
  );
}

function ProxyBadge({ proxied }: { proxied: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        proxied ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-100 text-zinc-600"
      }`}
    >
      Proxy {proxied ? "Ativo" : "Inativo"}
    </span>
  );
}

export function DnsTemplatesPanel({ mode = "cards" }: { mode?: "cards" | "quick" }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [settings, setSettings] = useState<MiniHostSettings | null>(null);
  const [cloudflareConfigured, setCloudflareConfigured] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DnsTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    domainId: "",
    name: "",
    value: "",
    proxied: true,
    comment: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  async function reloadBaseData() {
    try {
      setIsLoading(true);
      const [domainData, settingsData] = await Promise.all([
        apiRequest<DomainsResponse>("/api/domains"),
        apiRequest<SettingsResponse>("/api/settings")
      ]);
      setDomains(domainData.domains);
      setSettings(settingsData.settings);
      setCloudflareConfigured(Boolean(settingsData.cloudflare?.hasToken ?? settingsData.cloudflareConfigured));
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível carregar templates."
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reloadBaseData();
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(
      () => setNotice(null),
      notice.type === "error" ? 6500 : 4200
    );

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain])), [domains]);
  const selectedDomain = domainById.get(form.domainId);
  const hasDefaultIp = Boolean(settings?.defaultVpsIp?.trim());
  const visibleTemplates =
    mode === "quick"
      ? quickTemplateOrder
          .map((templateId) => templates.find((template) => template.id === templateId))
          .filter((template): template is DnsTemplate => Boolean(template))
      : templates;
  const filteredTemplates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch || mode === "quick") {
      return visibleTemplates;
    }

    return visibleTemplates.filter((template) =>
      [template.name, template.shortName, template.type, template.description].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [mode, searchTerm, visibleTemplates]);

  function openTemplate(template: DnsTemplate) {
    const domainId = getInitialDomainId(domains, settings);
    const domain = domains.find((item) => item.id === domainId);

    setSelectedTemplate(template);
    setForm({
      domainId,
      name: template.suggestedName,
      value: getTemplateValue(template, domain, settings),
      proxied: template.type === "TXT" || template.type === "MX" ? false : template.proxied,
      comment: ""
    });
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setSelectedTemplate(null);
  }

  function updateField(key: keyof typeof form, value: string | boolean) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "domainId" && selectedTemplate) {
        const nextDomain = domainById.get(String(value));

        if (selectedTemplate.contentKind === "root-domain") {
          next.value = settings?.defaultDomain || nextDomain?.name || "";
        }

        if (selectedTemplate.contentKind === "default-ip") {
          next.value = settings?.defaultVpsIp ?? "";
        }
      }

      return next;
    });
  }

  async function createRecord(createInCloudflare: boolean) {
    if (!selectedTemplate) {
      return;
    }

    if (selectedTemplate.requiresDefaultIp && !hasDefaultIp) {
      setNotice({ type: "error", message: "Configure o IP padrão da VPS antes de usar este template." });
      return;
    }

    if (createInCloudflare && !selectedDomain?.zoneId) {
      setNotice({ type: "error", message: "Configure o Zone ID do domínio antes de criar na Cloudflare." });
      return;
    }

    if (createInCloudflare && !cloudflareConfigured) {
      setNotice({ type: "error", message: "Configure o token da Cloudflare em Configurações antes de criar registros reais." });
      return;
    }

    const payload: DnsRecordFormInput = {
      domainId: form.domainId,
      type: selectedTemplate.type,
      name: form.name.trim(),
      value: form.value.trim(),
      ttl: "auto",
      proxied: selectedTemplate.type === "TXT" || selectedTemplate.type === "MX" ? false : Boolean(form.proxied),
      status: "active",
      comment: form.comment.trim() || undefined,
      templateName: selectedTemplate.name
    };

    try {
      setIsSubmitting(true);
      await apiRequest<CreateRecordResponse>(createInCloudflare ? "/api/cloudflare/create-record" : "/api/records", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setNotice({
        type: "success",
        message: createInCloudflare ? "Template aplicado na Cloudflare com sucesso." : "Template aplicado localmente com sucesso."
      });
      setSelectedTemplate(null);
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível aplicar o template."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const templateNeedsIp = Boolean(selectedTemplate?.requiresDefaultIp);
  const isIpMissingForSelected = templateNeedsIp && !hasDefaultIp;
  const isFormIncomplete = !form.domainId || !form.name.trim() || !form.value.trim();
  const previewName = formatRecordPreviewName(form.name, selectedDomain);
  const isProxyLocked = selectedTemplate?.type === "TXT" || selectedTemplate?.type === "MX";
  const canSubmit = Boolean(selectedTemplate) && !isSubmitting && !isIpMissingForSelected && !isFormIncomplete;
  const canCreateInCloudflare = canSubmit && Boolean(selectedDomain?.zoneId) && cloudflareConfigured;
  const localDisabledReason = !canSubmit
    ? isIpMissingForSelected
      ? "Configure o IP padrão da VPS em Configurações antes de usar este template."
      : isFormIncomplete
        ? "Preencha domínio, nome e conteúdo para criar o registro."
        : undefined
    : undefined;
  const cloudflareDisabledReason = !canCreateInCloudflare
    ? !cloudflareConfigured
      ? "Configure o token da Cloudflare em Configurações."
      : selectedDomain && !selectedDomain.zoneId
        ? "Configure o Zone ID deste domínio para criar registros reais na Cloudflare."
        : localDisabledReason
    : undefined;

  if (mode === "quick") {
    return (
      <div className="space-y-4">
        {notice ? <Toast type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;
            const isDisabled = isLoading || domains.length === 0 || Boolean(template.requiresDefaultIp && !hasDefaultIp);
            const style = quickTemplateStyles[template.id] ?? {
              icon: "border-zinc-100 bg-zinc-50 text-zinc-700",
              text: "text-zinc-700",
              border: "hover:border-zinc-300 hover:bg-zinc-50"
            };

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => openTemplate(template)}
                disabled={isDisabled}
                className={`inline-flex min-h-16 items-center justify-start gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${style.border} ${style.text}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${style.icon}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {template.shortName}
              </button>
            );
          })}
        </div>
        {renderTemplateModal()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice ? <Toast type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}

      <label className="relative block max-w-xl">
        <span className="sr-only">Buscar templates</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar templates..."
          className="h-11 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      {filteredTemplates.length === 0 && !isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-500">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-950">Nenhum template encontrado</h3>
          <p className="mt-2 text-sm text-zinc-500">Tente buscar por API, VPS, TXT, CNAME ou subdomínio.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;
            const isDisabled = isLoading || domains.length === 0 || Boolean(template.requiresDefaultIp && !hasDefaultIp);

            return (
              <article
                key={template.id}
                className={`rounded-lg border bg-white p-5 shadow-sm transition ${
                  isDisabled ? "border-zinc-200 opacity-65" : "border-zinc-200 hover:border-blue-200 hover:shadow-soft"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {template.recommended ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        Recomendado
                      </span>
                    ) : null}
                    <TemplateTypeBadge type={template.type} />
                  </div>
                </div>

                <h3 className="mt-4 text-base font-semibold text-zinc-950">{template.name}</h3>
                <p className="mt-2 min-h-14 text-sm leading-6 text-zinc-500">{template.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ProxyBadge proxied={template.proxied} />
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                    TTL Automático
                  </span>
                </div>

                {template.requiresDefaultIp && !hasDefaultIp ? (
                  <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>Defina um IP padrão em Configurações para usar este template.</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => openTemplate(template)}
                  disabled={isDisabled}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Usar template
                </button>
              </article>
            );
          })}
        </div>
      )}

      {renderTemplateModal()}
    </div>
  );

  function renderTemplateModal() {
    if (!selectedTemplate) {
      return null;
    }

    return (
      <Modal
        isOpen={Boolean(selectedTemplate)}
        title="Usar template"
        onClose={closeModal}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createRecord(false)}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Criando..." : "Criar apenas localmente"}
              </button>
              {localDisabledReason ? (
                <FieldInfoTooltip label="Criar apenas localmente" description={localDisabledReason} />
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createRecord(true)}
                disabled={!canCreateInCloudflare}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Cloud className="h-4 w-4" />
                {isSubmitting ? "Criando..." : "Criar na Cloudflare"}
              </button>
              {cloudflareDisabledReason ? (
                <FieldInfoTooltip label="Criar na Cloudflare" description={cloudflareDisabledReason} />
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              {selectedTemplate.name} ({selectedTemplate.type})
            </p>
            <p className="mt-1 text-sm text-zinc-500">{selectedTemplate.description}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-700" htmlFor="template-domain">
                    Domínio
                  </label>
                  <select
                    id="template-domain"
                    value={form.domainId}
                    onChange={(event) => updateField("domainId", event.target.value)}
                    className={fieldClass}
                  >
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700" htmlFor="template-type">
                    Tipo
                  </label>
                  <input id="template-type" value={selectedTemplate.type} className={`${fieldClass} bg-zinc-100`} readOnly />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-700" htmlFor="template-name">
                    Nome/subdomínio
                  </label>
                  <input
                    id="template-name"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className={fieldClass}
                    placeholder="@, api, app"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-zinc-700" htmlFor="template-value">
                      Valor/conteúdo
                    </label>
                    {isIpMissingForSelected ? (
                      <FieldInfoTooltip
                        label="Valor/conteúdo"
                        description="Configure o IP padrão da VPS em Configurações. Este template usa esse IP automaticamente."
                      />
                    ) : null}
                  </div>
                  <input
                    id="template-value"
                    value={form.value}
                    onChange={(event) => updateField("value", event.target.value)}
                    className={fieldClass}
                    placeholder={selectedTemplate.type === "TXT" ? "valor-de-verificacao" : "203.0.113.42"}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                  <span className="flex items-center gap-2">
                    Proxy ativo
                    {isProxyLocked ? (
                      <FieldInfoTooltip
                        label="Proxy ativo"
                        description="Registros TXT e MX não podem usar proxy na Cloudflare."
                      />
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={!isProxyLocked && form.proxied}
                    disabled={isProxyLocked}
                    onChange={(event) => updateField("proxied", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <div>
                  <label className="text-sm font-medium text-zinc-700" htmlFor="template-comment">
                    Comentário opcional
                  </label>
                  <input
                    id="template-comment"
                    value={form.comment}
                    onChange={(event) => updateField("comment", event.target.value)}
                    className={fieldClass}
                    placeholder="Observação interna"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-zinc-950">Preview do registro</p>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Nome final</dt>
                  <dd className="mt-1 break-all font-medium text-zinc-950">{previewName}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Tipo</dt>
                  <dd className="mt-1 font-medium text-zinc-950">{selectedTemplate.type}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Valor</dt>
                  <dd className="mt-1 break-all font-medium text-zinc-950">{form.value || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Proxy</dt>
                  <dd className="mt-1 font-medium text-zinc-950">{isProxyLocked || !form.proxied ? "Inativo" : "Ativo"} {isProxyLocked || !form.proxied ? "" : "(Proxied)"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">TTL</dt>
                  <dd className="mt-1 font-medium text-zinc-950">Automático</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
}
