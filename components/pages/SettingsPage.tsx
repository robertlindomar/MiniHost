"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { Notice } from "@/components/ui/Notice";
import {
  addHistoryItem,
  initializeMiniHostStorage,
  loadSettings,
  saveSettings
} from "@/lib/storage";
import type { MiniHostSettings } from "@/lib/types";

export function SettingsPage() {
  const [settings, setSettings] = useState<MiniHostSettings>({
    cloudflareApiToken: "",
    defaultZoneId: "",
    defaultDomain: "",
    defaultVpsIp: "",
    defaultProxyEnabled: true
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    initializeMiniHostStorage();
    setSettings(loadSettings());
  }, []);

  function updateField<Key extends keyof MiniHostSettings>(key: Key, value: MiniHostSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    saveSettings(settings);
    addHistoryItem({
      action: "Configurações salvas",
      entityType: "settings",
      entityName: "Configurações",
      description: "Preferências locais atualizadas."
    });
    setNotice("Configurações salvas com sucesso.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Configurações</h2>
        <p className="mt-1 text-sm text-zinc-500">Preferências locais para evoluções futuras do MiniHost.</p>
      </div>

      {notice ? <Notice type="success" message={notice} /> : null}

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
                onChange={(event) => updateField("defaultProxyEnabled", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-zinc-200 pt-5">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Save className="h-4 w-4" />
            Salvar configurações
          </button>
        </div>
      </form>
    </div>
  );
}
