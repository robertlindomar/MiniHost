import { Loader2, Save } from "lucide-react";

interface SaveSettingsButtonProps {
  isSaving?: boolean;
  disabled?: boolean;
}

export function SaveSettingsButton({ isSaving = false, disabled = false }: SaveSettingsButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || isSaving}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
    >
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {isSaving ? "Salvando..." : "Salvar configurações"}
    </button>
  );
}
