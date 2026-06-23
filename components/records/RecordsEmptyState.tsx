import { Cloud, Plus, RadioTower } from "lucide-react";

interface RecordsEmptyStateProps {
  isFiltered?: boolean;
  canSync?: boolean;
  onCreate: () => void;
  onSync: () => void;
}

export function RecordsEmptyState({ isFiltered = false, canSync = false, onCreate, onSync }: RecordsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <RadioTower className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-950">Nenhum registro DNS encontrado</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {isFiltered ? "Altere os filtros para localizar outros registros." : "Crie seu primeiro registro DNS ou sincronize com a Cloudflare."}
      </p>
      {!isFiltered ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Novo registro DNS
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={!canSync}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Cloud className="h-4 w-4" />
            Sincronizar com Cloudflare
          </button>
        </div>
      ) : null}
    </div>
  );
}
