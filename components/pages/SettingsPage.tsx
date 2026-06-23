"use client";

import { Cloud, Globe2, Loader2, Server, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AlertBox } from "@/components/settings/AlertBox";
import { FormField, settingsFieldClass, settingsFieldErrorClass } from "@/components/settings/FormField";
import { SaveSettingsButton } from "@/components/settings/SaveSettingsButton";
import { SecretInput } from "@/components/settings/SecretInput";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsLoadingState } from "@/components/settings/SettingsLoadingState";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsStatusBadge } from "@/components/settings/SettingsStatusBadge";
import { Toast } from "@/components/ui/Toast";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import { apiRequest } from "@/lib/api-client";
import { validateSettingsInput, type SettingsFieldErrors } from "@/lib/settings";
import type { Domain, MiniHostSettings } from "@/lib/types";

type CloudflareTokenSource = "environment" | "database" | "none";
type ToastState = { type: "success" | "error" | "info"; message: string } | null;

type SettingsResponse = {
  settings: MiniHostSettings;
  cloudflareConfigured?: boolean;
  cloudflareTokenSource?: CloudflareTokenSource;
  hasStoredCloudflareToken?: boolean;
};

type DomainsResponse = { domains: Domain[] };
type TestConnectionResponse = { message: string };

const defaultSettings: MiniHostSettings = {
  cloudflareApiToken: "",
  defaultZoneId: "",
  defaultDomain: "",
  defaultVpsIp: "",
  defaultProxyEnabled: true
};

export function SettingsPage() {
  const [settings, setSettings] = useState<MiniHostSettings>(defaultSettings);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tokenDraft, setTokenDraft] = useState("");
  const [cloudflareConfigured, setCloudflareConfigured] = useState(false);
  const [cloudflareTokenSource, setCloudflareTokenSource] = useState<CloudflareTokenSource>("none");
  const [hasStoredCloudflareToken, setHasStoredCloudflareToken] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SettingsFieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  async function loadPageData() {
    try {
      setIsLoading(true);
      const [settingsData, domainsData] = await Promise.all([
        apiRequest<SettingsResponse>("/api/settings"),
        apiRequest<DomainsResponse>("/api/domains")
      ]);

      setSettings(settingsData.settings);
      setDomains(domainsData.domains);
      setCloudflareConfigured(Boolean(settingsData.cloudflareConfigured));
      setCloudflareTokenSource(settingsData.cloudflareTokenSource ?? "none");
      setHasStoredCloudflareToken(Boolean(settingsData.hasStoredCloudflareToken));
      setTokenDraft("");
      setFieldErrors({});
      setLoadError(null);
      setFailedToLoad(false);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Não foi possível carregar as configurações.";
      setLoadError(message);
      setFailedToLoad(true);
      setToast({ type: "error", message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(
      () => setToast(null),
      toast.type === "error" ? 6500 : 4200
    );

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const tokenFromEnvironment = cloudflareTokenSource === "environment";
  const hasDomains = domains.length > 0;

  function updateField<Key extends keyof MiniHostSettings>(key: Key, value: MiniHostSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateForm() {
    const payload: MiniHostSettings = {
      ...settings,
      cloudflareApiToken: tokenDraft
    };
    const validation = validateSettingsInput(payload);
    setFieldErrors(validation.errors);
    return validation;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateForm();

    if (!validation.isValid) {
      setToast({ type: "error", message: "Verifique os campos destacados." });
      return;
    }

    try {
      setIsSaving(true);
      const payload: MiniHostSettings = {
        ...validation.data,
        cloudflareApiToken: tokenDraft
      };

      const data = await apiRequest<SettingsResponse>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      setSettings(data.settings);
      setCloudflareConfigured(Boolean(data.cloudflareConfigured));
      setCloudflareTokenSource(data.cloudflareTokenSource ?? "none");
      setHasStoredCloudflareToken(Boolean(data.hasStoredCloudflareToken));
      setTokenDraft("");
      setToast({ type: "success", message: "Configurações salvas com sucesso." });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar as configurações."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    const zoneValidation = validateSettingsInput({
      ...settings,
      defaultZoneId: settings.defaultZoneId
    });

    if (zoneValidation.errors.defaultZoneId) {
      setFieldErrors((current) => ({ ...current, defaultZoneId: zoneValidation.errors.defaultZoneId }));
      setToast({ type: "error", message: "Informe um Zone ID válido antes de testar a conexão." });
      return;
    }

    try {
      setIsTestingConnection(true);
      const data = await apiRequest<TestConnectionResponse>("/api/settings/test-cloudflare", {
        method: "POST",
        body: JSON.stringify({ zoneId: settings.defaultZoneId })
      });
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível validar a conexão com Cloudflare.";
      setToast({ type: "error", message });
    } finally {
      setIsTestingConnection(false);
    }
  }

  function fieldClassName(hasError?: boolean) {
    return hasError ? settingsFieldErrorClass : settingsFieldClass;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SettingsPageHeader isSaving={isSaving} disableSave={isLoading} />

      {isLoading ? (
        <SettingsLoadingState />
      ) : failedToLoad ? (
        <section className="overflow-hidden rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-soft">
          <p className="text-sm font-semibold text-rose-800">Não foi possível carregar as configurações.</p>
          <p className="mt-2 text-sm text-rose-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadPageData()}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Tentar novamente
          </button>
        </section>
      ) : (
        <form id="settings-form" onSubmit={handleSubmit} className="space-y-5">
          <SettingsCard
            title="Cloudflare"
            description="Integração usada para sincronizar e publicar registros DNS."
            icon={<Cloud className="h-5 w-5 text-orange-500" />}
            badge={<SettingsStatusBadge configured={cloudflareConfigured} />}
          >
            {tokenFromEnvironment ? (
              <AlertBox type="info" message="Token configurado via variável de ambiente." />
            ) : null}

            <FormField
              id="settings-token"
              label="Cloudflare API Token"
              info="Token com permissão de leitura e edição de DNS na zona."
            >
              <SecretInput
                id="settings-token"
                value={tokenDraft}
                onChange={setTokenDraft}
                disabled={isSaving || tokenFromEnvironment}
                hasStoredValue={hasStoredCloudflareToken}
                placeholder="Informe um novo token para substituir o atual"
              />
            </FormField>

            <FormField
              id="settings-zone"
              label="Zone ID padrão"
              info="Zone ID usada como padrão ao criar ou sincronizar registros."
              error={fieldErrors.defaultZoneId}
            >
              <input
                id="settings-zone"
                value={settings.defaultZoneId}
                disabled={isSaving}
                onChange={(event) => updateField("defaultZoneId", event.target.value)}
                className={fieldClassName(Boolean(fieldErrors.defaultZoneId))}
                placeholder="Zone ID da Cloudflare"
              />
            </FormField>

            {!settings.defaultZoneId.trim() ? (
              <AlertBox type="warning" message="Zone ID ausente. A sincronização com Cloudflare pode ficar indisponível." />
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={isSaving || isTestingConnection || !cloudflareConfigured}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {isTestingConnection ? "Testando conexão..." : "Testar conexão"}
              </button>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Domínio padrão"
            description="Preferência usada ao criar novos registros e templates."
            icon={<Globe2 className="h-5 w-5 text-blue-600" />}
          >
            {!hasDomains ? (
              <AlertBox
                type="warning"
                message="Cadastre um domínio antes de definir o domínio padrão."
              />
            ) : null}

            <FormField
              id="settings-domain"
              label="Domínio padrão"
              info="Domínio que será pré-selecionado em novos registros e templates."
              error={fieldErrors.defaultDomain}
            >
              {hasDomains ? (
                <select
                  id="settings-domain"
                  value={settings.defaultDomain}
                  disabled={isSaving}
                  onChange={(event) => updateField("defaultDomain", event.target.value)}
                  className={fieldClassName(Boolean(fieldErrors.defaultDomain))}
                >
                  <option value="">Selecione um domínio</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.name}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="settings-domain"
                  value={settings.defaultDomain}
                  disabled={isSaving}
                  onChange={(event) => updateField("defaultDomain", event.target.value)}
                  className={fieldClassName(Boolean(fieldErrors.defaultDomain))}
                  placeholder="exemplo.com"
                />
              )}
            </FormField>
          </SettingsCard>

          <SettingsCard
            title="VPS"
            description="IP sugerido para registros A e templates operacionais."
            icon={<Server className="h-5 w-5 text-violet-600" />}
          >
            <FormField
              id="settings-vps-ip"
              label="IP padrão da VPS"
              info="Este IP será sugerido ao criar registros do tipo A e templates como API, App e Painel."
              error={fieldErrors.defaultVpsIp}
            >
              <input
                id="settings-vps-ip"
                value={settings.defaultVpsIp}
                disabled={isSaving}
                onChange={(event) => updateField("defaultVpsIp", event.target.value)}
                className={fieldClassName(Boolean(fieldErrors.defaultVpsIp))}
                placeholder="203.0.113.42"
              />
            </FormField>

            {!settings.defaultVpsIp.trim() ? (
              <AlertBox
                type="warning"
                message="IP padrão da VPS ausente. Alguns templates ficarão desabilitados."
              />
            ) : null}
          </SettingsCard>

          <SettingsCard
            title="Preferências de DNS"
            description="Comportamento padrão para novos registros."
            icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
          >
            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4">
              <input
                id="settings-proxy"
                type="checkbox"
                checked={settings.defaultProxyEnabled}
                disabled={isSaving}
                onChange={(event) => updateField("defaultProxyEnabled", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                Ativar proxy Cloudflare por padrão
                <FieldInfoTooltip
                  label="Proxy Cloudflare por padrão"
                  description="Novos registros serão criados com proxy ativado quando o tipo permitir. Registros TXT e MX continuam sem proxy e podem ser ajustados individualmente ao criar cada registro."
                />
              </span>
            </label>
          </SettingsCard>

          <div className="flex justify-end border-t border-zinc-200 pt-5">
            <SaveSettingsButton isSaving={isSaving} disabled={isLoading} />
          </div>
        </form>
      )}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
