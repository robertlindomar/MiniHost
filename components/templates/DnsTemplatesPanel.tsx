"use client";

import { Cloud, Code2, Globe2, PanelTop, Plus, Server, ShieldCheck, TextCursorInput } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
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
  icon: typeof Server;
}

type DomainsResponse = { domains: Domain[] };
type SettingsResponse = { settings: MiniHostSettings };
type CreateRecordResponse = { record: DnsRecord; message?: string };

const templates: DnsTemplate[] = [
  {
    id: "vps-subdomain",
    name: "Subdomínio para VPS",
    shortName: "Novo Subdomínio",
    description: "Cria um subdomínio apontando para o IP padrão da VPS.",
    type: "A",
    suggestedName: "",
    contentKind: "default-ip",
    proxied: true,
    requiresDefaultIp: true,
    icon: Server
  },
  {
    id: "api",
    name: "API",
    shortName: "Novo API",
    description: "Cria api apontando para o IP padrão da VPS.",
    type: "A",
    suggestedName: "api",
    contentKind: "default-ip",
    proxied: true,
    requiresDefaultIp: true,
    icon: Code2
  },
  {
    id: "panel",
    name: "Painel/Admin",
    shortName: "Novo Painel",
    description: "Cria painel apontando para o IP padrão da VPS.",
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
    description: "Cria app apontando para o IP padrão da VPS.",
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
    description: "Cria www como CNAME para o domínio raiz.",
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
    description: "Cria um TXT para verificações de serviços externos.",
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
    description: "Cria um subdomínio A sem proxy Cloudflare.",
    type: "A",
    suggestedName: "",
    contentKind: "default-ip",
    proxied: false,
    requiresDefaultIp: true,
    icon: Server
  }
];

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
    return normalizedName || "-";
  }

  if (!normalizedName || normalizedName === "@") {
    return domain.name;
  }

  if (normalizedName.endsWith(`.${domain.name}`)) {
    return normalizedName;
  }

  return `${normalizedName}.${domain.name}`;
}

export function DnsTemplatesPanel({ mode = "cards" }: { mode?: "cards" | "quick" }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [settings, setSettings] = useState<MiniHostSettings | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DnsTemplate | null>(null);
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

  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain])), [domains]);
  const selectedDomain = domainById.get(form.domainId);
  const hasDefaultIp = Boolean(settings?.defaultVpsIp?.trim());
  const visibleTemplates = mode === "quick" ? templates.filter((template) => ["api", "panel", "app", "vps-subdomain"].includes(template.id)) : templates;

  function openTemplate(template: DnsTemplate) {
    const domainId = getInitialDomainId(domains, settings);
    const domain = domains.find((item) => item.id === domainId);

    setSelectedTemplate(template);
    setForm({
      domainId,
      name: template.suggestedName,
      value: getTemplateValue(template, domain, settings),
      proxied: template.proxied,
      comment: ""
    });
  }

  function closeModal() {
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
      const result = await apiRequest<CreateRecordResponse>(createInCloudflare ? "/api/cloudflare/create-record" : "/api/records", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setNotice({
        type: "success",
        message: result.message || (createInCloudflare ? "Registro criado na Cloudflare com sucesso." : "Registro criado apenas localmente.")
      });
      closeModal();
    } catch (requestError) {
      setNotice({
        type: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : createInCloudflare
              ? "Não foi possível criar o registro na Cloudflare."
              : "Não foi possível criar o registro local."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const templateNeedsIp = Boolean(selectedTemplate?.requiresDefaultIp);
  const isIpMissingForSelected = templateNeedsIp && !hasDefaultIp;
  const isFormIncomplete = !form.domainId || !form.name.trim() || !form.value.trim();
  const previewName = formatRecordPreviewName(form.name, selectedDomain);

  if (mode === "quick") {
    return (
      <div className="space-y-4">
        {notice ? <Notice type={notice.type} message={notice.message} /> : null}
        <div className="flex flex-wrap gap-2">
          {visibleTemplates.map((template) => {
            const Icon = template.icon;
            const isDisabled = isLoading || domains.length === 0 || Boolean(template.requiresDefaultIp && !hasDefaultIp);

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => openTemplate(template)}
                disabled={isDisabled}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon className="h-4 w-4" />
                {template.shortName}
              </button>
            );
          })}
        </div>
        {domains.length === 0 && !isLoading ? <Notice type="info" message="Cadastre um domínio antes de usar templates." /> : null}
        {!hasDefaultIp && !isLoading ? <Notice type="info" message="Configure o IP padrão da VPS antes de usar templates com registro A." /> : null}
        {renderTemplateModal()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice ? <Notice type={notice.type} message={notice.message} /> : null}
      {isLoading ? <Notice type="info" message="Carregando templates DNS..." /> : null}
      {domains.length === 0 && !isLoading ? <Notice type="info" message="Cadastre um domínio antes de usar templates." /> : null}
      {!hasDefaultIp && !isLoading ? <Notice type="info" message="Configure o IP padrão da VPS antes de usar templates que dependem do IP da VPS." /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTemplates.map((template) => {
          const Icon = template.icon;
          const isDisabled = isLoading || domains.length === 0 || Boolean(template.requiresDefaultIp && !hasDefaultIp);

          return (
            <article key={template.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="info">{template.type}</Badge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-950">{template.name}</h3>
              <p className="mt-2 min-h-10 text-sm leading-6 text-zinc-500">{template.description}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-md bg-zinc-100 px-2 py-1">Proxy: {template.proxied ? "Ativo" : "Inativo"}</span>
                <span className="rounded-md bg-zinc-100 px-2 py-1">TTL: Automático</span>
              </div>
              {template.requiresDefaultIp && !hasDefaultIp ? (
                <p className="mt-4 text-xs font-medium text-amber-700">Configure o IP padrão da VPS antes de usar este template.</p>
              ) : null}
              <button
                type="button"
                onClick={() => openTemplate(template)}
                disabled={isDisabled}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Usar template
              </button>
            </article>
          );
        })}
      </div>

      {renderTemplateModal()}
    </div>
  );

  function renderTemplateModal() {
    if (!selectedTemplate) {
      return null;
    }

    const canSubmit = !isSubmitting && !isIpMissingForSelected && !isFormIncomplete;

    return (
      <Modal isOpen={Boolean(selectedTemplate)} title={`Template: ${selectedTemplate.name}`} onClose={closeModal} size="lg">
        <div className="space-y-5">
          {isIpMissingForSelected ? <Notice type="error" message="Configure o IP padrão da VPS antes de usar este template." /> : null}
          {isFormIncomplete ? <Notice type="info" message="Preencha domínio, nome e conteúdo para criar o registro." /> : null}

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
              <label className="text-sm font-medium text-zinc-700" htmlFor="template-value">
                Valor/conteúdo
              </label>
              <input
                id="template-value"
                value={form.value}
                onChange={(event) => updateField("value", event.target.value)}
                className={fieldClass}
                placeholder={selectedTemplate.type === "TXT" ? "valor-de-verificacao" : "72.60.250.39"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
              Proxy ativo
              <input
                type="checkbox"
                checked={selectedTemplate.type !== "TXT" && form.proxied}
                disabled={selectedTemplate.type === "TXT"}
                onChange={(event) => updateField("proxied", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="template-comment">
                Comentário
              </label>
              <input
                id="template-comment"
                value={form.comment}
                onChange={(event) => updateField("comment", event.target.value)}
                className={fieldClass}
                placeholder="Observação opcional"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Preview do registro</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Nome final</dt>
                <dd className="mt-1 font-medium text-zinc-950">{previewName}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Tipo</dt>
                <dd className="mt-1 font-medium text-zinc-950">{selectedTemplate.type}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Valor</dt>
                <dd className="mt-1 break-all font-medium text-zinc-950">{form.value || "-"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Proxy</dt>
                <dd className="mt-1 font-medium text-zinc-950">{selectedTemplate.type === "TXT" || !form.proxied ? "Inativo" : "Ativo"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">TTL</dt>
                <dd className="mt-1 font-medium text-zinc-950">Automático</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => createRecord(false)}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Criar apenas localmente
            </button>
            <button
              type="button"
              onClick={() => createRecord(true)}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Cloud className="h-4 w-4" />
              {isSubmitting ? "Criando..." : "Criar na Cloudflare"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
}
