"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { Notice } from "@/components/ui/Notice";
import { apiRequest } from "@/lib/api-client";
import type { MiniHostSettings } from "@/lib/types";

type SettingsResponse = { settings: MiniHostSettings };

export function SettingsPage() {
  const [settings, setSettings] = useState<MiniHostSettings>({
    cloudflareApiToken: "",
    defaultZoneId: "",
    defaultDomain: "",
    defaultVpsIp: "",
    defaultProxyEnabled: true
  });
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const data = await apiRequest<SettingsResponse>("/api/settings");
        setSettings(data.settings);
      } catch (requestError) {
        setNotice({
          type: "error",
          message: requestError instanceof Error ? requestError.message : "Não foi possível carregar configurações."
        });
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  function updateField<Key extends keyof MiniHostSettings>(key: Key, value: MiniHostSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      const data = await apiRequest<SettingsResponse>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      setSettings(data.settings);
      setNotice({ type: "success", message: "Configurações salvas com sucesso." });
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível salvar configurações."
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Configurações</h2>
        <p className="mt-1 text-sm text-zinc-500">Preferências salvas no PostgreSQL para evoluções futuras do MiniHost.</p>
      </div>

      {notice ? <Notice type={notice.type} message={notice.message} /> : null}
      {isLoading ? <Notice type="info" message="Carregando configurações..." /> : null}

      <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="settings-token">
              Cloudflare API Token
            </label>
            <input
              id="settings-token"
              type="password"
              value={settings.cloudflareApiToken}
              disabled={isLoading || isSaving}
              onChange={(event) => updateField("cloudflareApiToken", event.target.value)}
              className={fieldClass}
              placeholder="Token para uso futuro"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="settings-zone">
                Zone ID padrão
              </label>
              <input
                id="settings-zone"
                value={settings.defaultZoneId}
                disabled={isLoading || isSaving}
                onChange={(event) => updateField("defaultZoneId", event.target.value)}
                className={fieldClass}
                placeholder="fake-zone-id"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="settings-domain">
                Domínio padrão
              </label>
              <input
                id="settings-domain"
                value={settings.defaultDomain}
                disabled={isLoading || isSaving}
                onChange={(event) => updateField("defaultDomain", event.target.value)}
                className={fieldClass}
                placeholder="robertlindomar.dev"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="settings-vps-ip">
                IP padrão da VPS
              </label>
              <input
                id="settings-vps-ip"
                value={settings.defaultVpsIp}
                disabled={isLoading || isSaving}
                onChange={(event) => updateField("defaultVpsIp", event.target.value)}
                className={fieldClass}
                placeholder="72.60.250.39"
              />
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 sm:mt-6">
              Proxy Cloudflare padrão
              <input
                type="checkbox"
                checked={settings.defaultProxyEnabled}
                disabled={isLoading || isSaving}
                onChange={(event) => updateField("defaultProxyEnabled", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-zinc-200 pt-5">
          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
