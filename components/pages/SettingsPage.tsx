"use client";

import { Cloud, Database, Globe2, Loader2, Rocket, Server, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AlertBox } from "@/components/settings/AlertBox";
import { FormField, settingsFieldClass, settingsFieldErrorClass } from "@/components/settings/FormField";
import { SaveSettingsButton } from "@/components/settings/SaveSettingsButton";
import { SecretInput } from "@/components/settings/SecretInput";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsLoadingState } from "@/components/settings/SettingsLoadingState";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { CoolifyStatusBadge } from "@/components/settings/CoolifyStatusBadge";
import { PostgresAdminStatusBadge } from "@/components/settings/PostgresAdminStatusBadge";
import { SettingsStatusBadge } from "@/components/settings/SettingsStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import { pageContainerNarrowClass } from "@/components/layout/page-container";
import { apiRequest } from "@/lib/api-client";
import { MASKED_SECRET_VALUE, validateSettingsInput, type SettingsFieldErrors } from "@/lib/settings";
import type { CloudflareStatus, CoolifyStatus, Domain, MiniHostSettings, PostgresAdminStatus } from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;

type SettingsResponse = {
  settings: MiniHostSettings;
  cloudflare: CloudflareStatus;
  coolify?: CoolifyStatus;
  postgresAdmin?: PostgresAdminStatus;
};

type TokenMutationResponse = SettingsResponse & {
  message: string;
};

type PostgresCredentialMutationResponse = {
  message: string;
  postgresAdmin: PostgresAdminStatus;
};

type CoolifyCredentialMutationResponse = {
  message: string;
  coolify: CoolifyStatus;
};

type DomainsResponse = { domains: Domain[] };
type TestConnectionResponse = { message: string };

const defaultSettings: MiniHostSettings = {
  defaultZoneId: "",
  defaultDomain: "",
  defaultVpsIp: "",
  defaultProxyEnabled: true,
  defaultPostgresHost: "",
  defaultPostgresPort: "5432",
  defaultPostgresDatabaseSuffix: "_db",
  defaultPostgresUserSuffix: "_user"
};

const defaultCloudflareStatus: CloudflareStatus = {
  hasToken: false,
  connectionStatus: "not_configured"
};

const defaultPostgresAdminStatus: PostgresAdminStatus = {
  hasCredential: false,
  connectionStatus: "not_configured"
};

const defaultCoolifyStatus: CoolifyStatus = {
  hasCredential: false,
  connectionStatus: "not_configured"
};

export function SettingsPage() {
  const [settings, setSettings] = useState<MiniHostSettings>(defaultSettings);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [cloudflare, setCloudflare] = useState<CloudflareStatus>(defaultCloudflareStatus);
  const [coolify, setCoolify] = useState<CoolifyStatus>(defaultCoolifyStatus);
  const [postgresAdmin, setPostgresAdmin] = useState<PostgresAdminStatus>(defaultPostgresAdminStatus);
  const [tokenDraft, setTokenDraft] = useState("");
  const [coolifyDraft, setCoolifyDraft] = useState({
    baseUrl: "",
    token: ""
  });
  const [postgresCredentialDraft, setPostgresCredentialDraft] = useState({
    host: "",
    port: 5432,
    maintenanceDatabase: "postgres",
    username: "",
    password: "",
    sslEnabled: false
  });
  const [isReplacingToken, setIsReplacingToken] = useState(false);
  const [isReplacingCoolifyToken, setIsReplacingCoolifyToken] = useState(false);
  const [isReplacingPostgresPassword, setIsReplacingPostgresPassword] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemoveCoolifyDialogOpen, setIsRemoveCoolifyDialogOpen] = useState(false);
  const [isRemovePostgresDialogOpen, setIsRemovePostgresDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SettingsFieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isSavingCoolifyCredential, setIsSavingCoolifyCredential] = useState(false);
  const [isSavingPostgresCredential, setIsSavingPostgresCredential] = useState(false);
  const [isRemovingToken, setIsRemovingToken] = useState(false);
  const [isRemovingCoolifyCredential, setIsRemovingCoolifyCredential] = useState(false);
  const [isRemovingPostgresCredential, setIsRemovingPostgresCredential] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingCoolifyConnection, setIsTestingCoolifyConnection] = useState(false);
  const [isTestingPostgresConnection, setIsTestingPostgresConnection] = useState(false);
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
      setCloudflare(settingsData.cloudflare ?? defaultCloudflareStatus);
      setCoolify(settingsData.coolify ?? defaultCoolifyStatus);
      setPostgresAdmin(settingsData.postgresAdmin ?? defaultPostgresAdminStatus);
      setCoolifyDraft({
        baseUrl: settingsData.coolify?.baseUrl ?? "",
        token: ""
      });
      setPostgresCredentialDraft({
        host: settingsData.postgresAdmin?.host ?? settingsData.settings.defaultPostgresHost ?? "",
        port: settingsData.postgresAdmin?.port ?? Number(settingsData.settings.defaultPostgresPort || 5432),
        maintenanceDatabase: settingsData.postgresAdmin?.maintenanceDatabase ?? "postgres",
        username: settingsData.postgresAdmin?.username ?? "",
        password: "",
        sslEnabled: settingsData.postgresAdmin?.sslEnabled ?? false
      });
      setIsReplacingPostgresPassword(false);
      setTokenDraft("");
      setIsReplacingToken(false);
      setIsReplacingCoolifyToken(false);
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

  const hasDomains = domains.length > 0;
  const hasStoredToken = cloudflare.hasToken;
  const hasStoredCoolifyCredential = coolify.hasCredential;
  const hasStoredPostgresCredential = postgresAdmin.hasCredential;
  const showTokenInput = !hasStoredToken || isReplacingToken;
  const showCoolifyTokenInput = !hasStoredCoolifyCredential || isReplacingCoolifyToken;
  const showPostgresPasswordInput = !hasStoredPostgresCredential || isReplacingPostgresPassword;

  function updateField<Key extends keyof MiniHostSettings>(key: Key, value: MiniHostSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateForm() {
    const validation = validateSettingsInput(settings);
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
      const data = await apiRequest<SettingsResponse>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(validation.data)
      });

      setSettings(data.settings);
      setCloudflare(data.cloudflare ?? defaultCloudflareStatus);
      setCoolify(data.coolify ?? defaultCoolifyStatus);
      setPostgresAdmin(data.postgresAdmin ?? defaultPostgresAdminStatus);
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

  async function handleSaveToken() {
    if (!tokenDraft.trim()) {
      setToast({ type: "error", message: "Informe o token da Cloudflare." });
      return;
    }

    try {
      setIsSavingToken(true);
      const data = await apiRequest<TokenMutationResponse>("/api/settings/cloudflare-token", {
        method: "POST",
        body: JSON.stringify({ token: tokenDraft })
      });

      setCloudflare(data.cloudflare ?? defaultCloudflareStatus);
      setTokenDraft("");
      setIsReplacingToken(false);
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar o token."
      });
    } finally {
      setIsSavingToken(false);
    }
  }

  async function handleRemoveToken() {
    try {
      setIsRemovingToken(true);
      const data = await apiRequest<TokenMutationResponse>("/api/settings/cloudflare-token", {
        method: "DELETE"
      });

      setCloudflare(data.cloudflare ?? defaultCloudflareStatus);
      setTokenDraft("");
      setIsReplacingToken(false);
      setIsRemoveDialogOpen(false);
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível remover o token."
      });
    } finally {
      setIsRemovingToken(false);
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
      setCloudflare((current) => ({
        ...current,
        connectionStatus: "connected",
        lastTestMessage: data.message,
        lastTestedAt: new Date().toISOString()
      }));
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível conectar à Cloudflare. Verifique o token e o Zone ID.";
      setCloudflare((current) => ({
        ...current,
        connectionStatus: "error",
        lastTestMessage: message,
        lastTestedAt: new Date().toISOString()
      }));
      setToast({ type: "error", message });
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function handleSaveCoolifyCredential() {
    if (!coolifyDraft.baseUrl.trim()) {
      setToast({ type: "error", message: "Informe a URL base do Coolify." });
      return;
    }

    if (!hasStoredCoolifyCredential && !coolifyDraft.token.trim()) {
      setToast({ type: "error", message: "Informe o token da API do Coolify." });
      return;
    }

    if (isReplacingCoolifyToken && !coolifyDraft.token.trim()) {
      setToast({ type: "error", message: "Informe o novo token da API do Coolify." });
      return;
    }

    try {
      setIsSavingCoolifyCredential(true);
      const data = await apiRequest<CoolifyCredentialMutationResponse>("/api/settings/coolify", {
        method: "POST",
        body: JSON.stringify(coolifyDraft)
      });

      setCoolify(data.coolify);
      setCoolifyDraft((current) => ({ ...current, token: "" }));
      setIsReplacingCoolifyToken(false);
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message:
          requestError instanceof Error ? requestError.message : "Não foi possível salvar a configuração do Coolify."
      });
    } finally {
      setIsSavingCoolifyCredential(false);
    }
  }

  async function handleRemoveCoolifyCredential() {
    try {
      setIsRemovingCoolifyCredential(true);
      const data = await apiRequest<CoolifyCredentialMutationResponse>("/api/settings/coolify", {
        method: "DELETE"
      });

      setCoolify(data.coolify);
      setCoolifyDraft({ baseUrl: "", token: "" });
      setIsReplacingCoolifyToken(false);
      setIsRemoveCoolifyDialogOpen(false);
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message:
          requestError instanceof Error ? requestError.message : "Não foi possível remover a configuração do Coolify."
      });
    } finally {
      setIsRemovingCoolifyCredential(false);
    }
  }

  async function handleTestCoolifyConnection() {
    try {
      setIsTestingCoolifyConnection(true);
      const data = await apiRequest<TestConnectionResponse>("/api/settings/coolify/test", {
        method: "POST"
      });
      setCoolify((current) => ({
        ...current,
        connectionStatus: "connected",
        lastTestMessage: data.message,
        lastTestedAt: new Date().toISOString()
      }));
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível conectar ao Coolify. Verifique URL, token e permissões.";
      setCoolify((current) => ({
        ...current,
        connectionStatus: "error",
        lastTestMessage: message,
        lastTestedAt: new Date().toISOString()
      }));
      setToast({ type: "error", message });
    } finally {
      setIsTestingCoolifyConnection(false);
    }
  }

  async function handleTestPostgresConnection() {
    try {
      setIsTestingPostgresConnection(true);
      const data = await apiRequest<TestConnectionResponse>("/api/settings/postgres/test", {
        method: "POST"
      });
      setPostgresAdmin((current) => ({
        ...current,
        connectionStatus: "connected",
        lastTestMessage: data.message,
        lastTestedAt: new Date().toISOString()
      }));
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível conectar ao PostgreSQL. Verifique host, porta, usuário e senha.";
      setPostgresAdmin((current) => ({
        ...current,
        connectionStatus: "error",
        lastTestMessage: message,
        lastTestedAt: new Date().toISOString()
      }));
      setToast({ type: "error", message });
    } finally {
      setIsTestingPostgresConnection(false);
    }
  }

  async function handleSavePostgresCredential() {
    if (!postgresCredentialDraft.host.trim()) {
      setToast({ type: "error", message: "Informe o host PostgreSQL." });
      return;
    }

    if (!postgresCredentialDraft.username.trim()) {
      setToast({ type: "error", message: "Informe o usuário administrativo." });
      return;
    }

    if (!hasStoredPostgresCredential && !postgresCredentialDraft.password.trim()) {
      setToast({ type: "error", message: "Informe a senha administrativa." });
      return;
    }

    if (isReplacingPostgresPassword && !postgresCredentialDraft.password.trim()) {
      setToast({ type: "error", message: "Informe a nova senha administrativa." });
      return;
    }

    try {
      setIsSavingPostgresCredential(true);
      const data = await apiRequest<PostgresCredentialMutationResponse>("/api/settings/postgres-credential", {
        method: "POST",
        body: JSON.stringify(postgresCredentialDraft)
      });

      setPostgresAdmin(data.postgresAdmin);
      setPostgresCredentialDraft((current) => ({ ...current, password: "" }));
      setIsReplacingPostgresPassword(false);
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar a credencial."
      });
    } finally {
      setIsSavingPostgresCredential(false);
    }
  }

  async function handleRemovePostgresCredential() {
    try {
      setIsRemovingPostgresCredential(true);
      const data = await apiRequest<PostgresCredentialMutationResponse>("/api/settings/postgres-credential", {
        method: "DELETE"
      });

      setPostgresAdmin(data.postgresAdmin);
      setPostgresCredentialDraft((current) => ({ ...current, password: "" }));
      setIsReplacingPostgresPassword(false);
      setIsRemovePostgresDialogOpen(false);
      setToast({ type: "success", message: data.message });
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível remover a credencial."
      });
    } finally {
      setIsRemovingPostgresCredential(false);
    }
  }

  function fieldClassName(hasError?: boolean) {
    return hasError ? settingsFieldErrorClass : settingsFieldClass;
  }

  return (
    <div className={pageContainerNarrowClass}>
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
            badge={<SettingsStatusBadge status={cloudflare.connectionStatus} />}
          >
            <FormField
              id="settings-token"
              label="Cloudflare API Token"
              info="Token com permissão de leitura e edição de DNS na zona. Depois de salvo, não pode ser visualizado novamente."
            >
              {showTokenInput ? (
                <SecretInput
                  id="settings-token"
                  value={tokenDraft}
                  onChange={setTokenDraft}
                  disabled={isSavingToken || isRemovingToken}
                  hasStoredValue={false}
                  placeholder="Cole o token da Cloudflare"
                />
              ) : (
                <input
                  id="settings-token"
                  type="password"
                  value={MASKED_SECRET_VALUE}
                  readOnly
                  disabled
                  className={`${settingsFieldClass} bg-zinc-50 text-zinc-500`}
                />
              )}
            </FormField>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {showTokenInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSaveToken()}
                    disabled={isSavingToken || isRemovingToken || !tokenDraft.trim()}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingToken ? "Salvando..." : hasStoredToken ? "Salvar novo token" : "Salvar token"}
                  </button>
                  {hasStoredToken ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplacingToken(false);
                        setTokenDraft("");
                      }}
                      disabled={isSavingToken || isRemovingToken}
                      className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplacingToken(true);
                      setTokenDraft("");
                    }}
                    disabled={isSavingToken || isRemovingToken}
                    className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Trocar token
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRemoveDialogOpen(true)}
                    disabled={isSavingToken || isRemovingToken}
                    className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remover token
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={isSaving || isTestingConnection || !hasStoredToken || isReplacingToken}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {isTestingConnection ? "Testando conexão..." : "Testar conexão"}
              </button>
            </div>

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
          </SettingsCard>

          <SettingsCard
            title="Coolify"
            description="Integração em modo leitura para listar servidores, projetos e aplicações."
            icon={<Rocket className="h-5 w-5 text-emerald-600" />}
            badge={<CoolifyStatusBadge status={coolify.connectionStatus} />}
          >
            <FormField
              id="coolify-base-url"
              label="URL base do Coolify"
              info="Informe a URL do painel Coolify, por exemplo https://coolify.exemplo.com."
            >
              <input
                id="coolify-base-url"
                value={coolifyDraft.baseUrl}
                disabled={isSavingCoolifyCredential || isRemovingCoolifyCredential}
                onChange={(event) =>
                  setCoolifyDraft((current) => ({ ...current, baseUrl: event.target.value }))
                }
                className={settingsFieldClass}
                placeholder="https://coolify.exemplo.com"
              />
            </FormField>

            <FormField
              id="coolify-token"
              label="Coolify API Token"
              info="Token salvo criptografado. Depois de salvo, não pode ser visualizado novamente."
            >
              {showCoolifyTokenInput ? (
                <SecretInput
                  id="coolify-token"
                  value={coolifyDraft.token}
                  onChange={(value) => setCoolifyDraft((current) => ({ ...current, token: value }))}
                  disabled={isSavingCoolifyCredential || isRemovingCoolifyCredential}
                  hasStoredValue={false}
                  placeholder="Cole o token do Coolify"
                />
              ) : (
                <input
                  id="coolify-token"
                  type="password"
                  value={MASKED_SECRET_VALUE}
                  readOnly
                  disabled
                  className={`${settingsFieldClass} bg-zinc-50 text-zinc-500`}
                />
              )}
            </FormField>

            {coolify.lastTestedAt ? (
              <AlertBox
                type={coolify.connectionStatus === "error" ? "warning" : "info"}
                message={
                  coolify.lastTestMessage
                    ? `Último teste (${new Date(coolify.lastTestedAt).toLocaleString("pt-BR")}): ${coolify.lastTestMessage}`
                    : `Último teste em ${new Date(coolify.lastTestedAt).toLocaleString("pt-BR")}.`
                }
              />
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => void handleSaveCoolifyCredential()}
                disabled={isSavingCoolifyCredential || isRemovingCoolifyCredential}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingCoolifyCredential ? "Salvando..." : "Salvar configuração"}
              </button>

              {hasStoredCoolifyCredential && !showCoolifyTokenInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplacingCoolifyToken(true);
                    setCoolifyDraft((current) => ({ ...current, token: "" }));
                  }}
                  disabled={isSavingCoolifyCredential || isRemovingCoolifyCredential}
                  className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Trocar token
                </button>
              ) : null}

              {hasStoredCoolifyCredential && showCoolifyTokenInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplacingCoolifyToken(false);
                    setCoolifyDraft((current) => ({ ...current, token: "" }));
                  }}
                  disabled={isSavingCoolifyCredential || isRemovingCoolifyCredential}
                  className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar troca
                </button>
              ) : null}

              {hasStoredCoolifyCredential ? (
                <button
                  type="button"
                  onClick={() => setIsRemoveCoolifyDialogOpen(true)}
                  disabled={isSavingCoolifyCredential || isRemovingCoolifyCredential}
                  className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remover token
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void handleTestCoolifyConnection()}
                disabled={
                  isSavingCoolifyCredential ||
                  isRemovingCoolifyCredential ||
                  isTestingCoolifyConnection ||
                  !hasStoredCoolifyCredential ||
                  isReplacingCoolifyToken
                }
                className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTestingCoolifyConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {isTestingCoolifyConnection ? "Testando conexão..." : "Testar conexão"}
              </button>
            </div>

            <AlertBox
              type="info"
              message="Nesta etapa, o MiniHost apenas lê e sincroniza recursos do Coolify. Nenhum deploy, edição ou exclusão é executado."
            />
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

          <SettingsCard
            title="Credencial administrativa PostgreSQL"
            description="Usuário com permissão para criar bancos e roles no servidor PostgreSQL."
            icon={<Database className="h-5 w-5 text-violet-600" />}
            badge={<PostgresAdminStatusBadge status={postgresAdmin.connectionStatus} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="postgres-admin-host" label="Host" info="Servidor PostgreSQL onde os bancos serão criados.">
                <input
                  id="postgres-admin-host"
                  value={postgresCredentialDraft.host}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  onChange={(event) =>
                    setPostgresCredentialDraft((current) => ({ ...current, host: event.target.value }))
                  }
                  className={settingsFieldClass}
                  placeholder="postgres.exemplo.com"
                />
              </FormField>
              <FormField id="postgres-admin-port" label="Porta">
                <input
                  id="postgres-admin-port"
                  type="number"
                  value={postgresCredentialDraft.port}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  onChange={(event) =>
                    setPostgresCredentialDraft((current) => ({
                      ...current,
                      port: Number(event.target.value) || 5432
                    }))
                  }
                  className={settingsFieldClass}
                  placeholder="5432"
                />
              </FormField>
              <FormField
                id="postgres-admin-maintenance-db"
                label="Database de manutenção"
                info="Database usado para conectar antes de criar novos bancos, ex.: postgres."
              >
                <input
                  id="postgres-admin-maintenance-db"
                  value={postgresCredentialDraft.maintenanceDatabase}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  onChange={(event) =>
                    setPostgresCredentialDraft((current) => ({
                      ...current,
                      maintenanceDatabase: event.target.value
                    }))
                  }
                  className={settingsFieldClass}
                  placeholder="postgres"
                />
              </FormField>
              <FormField id="postgres-admin-username" label="Usuário admin/provisionador">
                <input
                  id="postgres-admin-username"
                  value={postgresCredentialDraft.username}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  onChange={(event) =>
                    setPostgresCredentialDraft((current) => ({ ...current, username: event.target.value }))
                  }
                  className={settingsFieldClass}
                  placeholder="postgres_admin"
                />
              </FormField>
            </div>

            <FormField
              id="postgres-admin-password"
              label="Senha"
              info="Salva criptografada. Não será exibida novamente após salvar."
            >
              {showPostgresPasswordInput ? (
                <SecretInput
                  id="postgres-admin-password"
                  value={postgresCredentialDraft.password}
                  onChange={(value) => setPostgresCredentialDraft((current) => ({ ...current, password: value }))}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  hasStoredValue={false}
                  placeholder="Senha do usuário administrativo"
                />
              ) : (
                <input
                  id="postgres-admin-password"
                  type="password"
                  value={MASKED_SECRET_VALUE}
                  readOnly
                  disabled
                  className={`${settingsFieldClass} bg-zinc-50 text-zinc-500`}
                />
              )}
            </FormField>

            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4">
              <input
                id="postgres-admin-ssl"
                type="checkbox"
                checked={postgresCredentialDraft.sslEnabled}
                disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                onChange={(event) =>
                  setPostgresCredentialDraft((current) => ({ ...current, sslEnabled: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-medium text-zinc-900">SSL ativado</span>
            </label>

            {postgresAdmin.lastTestedAt ? (
              <AlertBox
                type={postgresAdmin.connectionStatus === "error" ? "warning" : "info"}
                message={
                  postgresAdmin.lastTestMessage
                    ? `Último teste (${new Date(postgresAdmin.lastTestedAt).toLocaleString("pt-BR")}): ${postgresAdmin.lastTestMessage}`
                    : `Último teste em ${new Date(postgresAdmin.lastTestedAt).toLocaleString("pt-BR")}.`
                }
              />
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => void handleSavePostgresCredential()}
                disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingPostgresCredential ? "Salvando..." : "Salvar credencial"}
              </button>

              {hasStoredPostgresCredential && !showPostgresPasswordInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplacingPostgresPassword(true);
                    setPostgresCredentialDraft((current) => ({ ...current, password: "" }));
                  }}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Trocar senha
                </button>
              ) : null}

              {hasStoredPostgresCredential ? (
                <button
                  type="button"
                  onClick={() => setIsRemovePostgresDialogOpen(true)}
                  disabled={isSavingPostgresCredential || isRemovingPostgresCredential}
                  className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remover credencial
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void handleTestPostgresConnection()}
                disabled={
                  isSavingPostgresCredential ||
                  isRemovingPostgresCredential ||
                  isTestingPostgresConnection ||
                  !hasStoredPostgresCredential
                }
                className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTestingPostgresConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {isTestingPostgresConnection ? "Testando conexão..." : "Testar conexão"}
              </button>
            </div>

            <AlertBox
              type="warning"
              message="Use credencial administrativa apenas em ambientes confiáveis. Nunca commite arquivos .env com senhas."
            />
          </SettingsCard>

          <SettingsCard
            title="PostgreSQL padrão"
            description="Valores sugeridos ao planejar bancos por projeto."
            icon={<Server className="h-5 w-5 text-violet-600" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="settings-postgres-host"
                label="Host padrão"
                info="Host sugerido para novos bancos planejados."
                error={fieldErrors.defaultPostgresHost}
              >
                <input
                  id="settings-postgres-host"
                  value={settings.defaultPostgresHost}
                  disabled={isSaving}
                  onChange={(event) => updateField("defaultPostgresHost", event.target.value)}
                  className={fieldClassName(Boolean(fieldErrors.defaultPostgresHost))}
                  placeholder="postgres.exemplo.com"
                />
              </FormField>
              <FormField
                id="settings-postgres-port"
                label="Porta padrão"
                error={fieldErrors.defaultPostgresPort}
              >
                <input
                  id="settings-postgres-port"
                  value={settings.defaultPostgresPort}
                  disabled={isSaving}
                  onChange={(event) => updateField("defaultPostgresPort", event.target.value)}
                  className={fieldClassName(Boolean(fieldErrors.defaultPostgresPort))}
                  placeholder="5432"
                />
              </FormField>
              <FormField
                id="settings-postgres-db-suffix"
                label="Sufixo do database"
                info="Concatenado ao slug do projeto. Ex.: systagio + _db"
                error={fieldErrors.defaultPostgresDatabaseSuffix}
              >
                <input
                  id="settings-postgres-db-suffix"
                  value={settings.defaultPostgresDatabaseSuffix}
                  disabled={isSaving}
                  onChange={(event) => updateField("defaultPostgresDatabaseSuffix", event.target.value)}
                  className={fieldClassName(Boolean(fieldErrors.defaultPostgresDatabaseSuffix))}
                  placeholder="_db"
                />
              </FormField>
              <FormField
                id="settings-postgres-user-suffix"
                label="Sufixo do usuário"
                info="Concatenado ao slug do projeto. Ex.: systagio + _user"
                error={fieldErrors.defaultPostgresUserSuffix}
              >
                <input
                  id="settings-postgres-user-suffix"
                  value={settings.defaultPostgresUserSuffix}
                  disabled={isSaving}
                  onChange={(event) => updateField("defaultPostgresUserSuffix", event.target.value)}
                  className={fieldClassName(Boolean(fieldErrors.defaultPostgresUserSuffix))}
                  placeholder="_user"
                />
              </FormField>
            </div>
          </SettingsCard>

          <div className="flex justify-end border-t border-zinc-200 pt-5">
            <SaveSettingsButton isSaving={isSaving} disabled={isLoading} />
          </div>
        </form>
      )}

      <ConfirmDialog
        isOpen={isRemoveDialogOpen}
        title="Remover token da Cloudflare"
        message="Tem certeza que deseja remover o token salvo? A sincronização e as operações reais na Cloudflare ficarão indisponíveis até cadastrar um novo token."
        confirmLabel="Remover token"
        confirmingLabel="Removendo..."
        onCancel={() => (isRemovingToken ? undefined : setIsRemoveDialogOpen(false))}
        onConfirm={() => void handleRemoveToken()}
        isConfirming={isRemovingToken}
      />

      <ConfirmDialog
        isOpen={isRemoveCoolifyDialogOpen}
        title="Remover token do Coolify"
        message="Tem certeza que deseja remover a configuração do Coolify? A listagem e sincronização de recursos ficarão indisponíveis até cadastrar uma nova credencial."
        confirmLabel="Remover token"
        confirmingLabel="Removendo..."
        onCancel={() => (isRemovingCoolifyCredential ? undefined : setIsRemoveCoolifyDialogOpen(false))}
        onConfirm={() => void handleRemoveCoolifyCredential()}
        isConfirming={isRemovingCoolifyCredential}
      />

      <ConfirmDialog
        isOpen={isRemovePostgresDialogOpen}
        title="Remover credencial PostgreSQL"
        message="Tem certeza que deseja remover a credencial administrativa? A criação real de bancos ficará indisponível até cadastrar uma nova credencial."
        confirmLabel="Remover credencial"
        confirmingLabel="Removendo..."
        onCancel={() => (isRemovingPostgresCredential ? undefined : setIsRemovePostgresDialogOpen(false))}
        onConfirm={() => void handleRemovePostgresCredential()}
        isConfirming={isRemovingPostgresCredential}
      />

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
