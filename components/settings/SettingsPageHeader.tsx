import { Loader2 } from "lucide-react";

interface SettingsPageHeaderProps {
  isSaving?: boolean;
  disableSave?: boolean;
}

export function SettingsPageHeader({ isSaving = false, disableSave = false }: SettingsPageHeaderProps) {
  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">Configurações</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">
          Gerencie integrações, padrões e preferências do sistema.
        </p>
      </div>
      <div className="lg:pt-1">
        <button
          type="submit"
          form="settings-form"
          disabled={disableSave || isSaving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSaving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </section>
  );
}
