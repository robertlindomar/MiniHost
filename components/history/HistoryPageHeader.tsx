import { Download, RefreshCw } from "lucide-react";

interface HistoryPageHeaderProps {
  isRefreshing?: boolean;
  isExporting?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  disableActions?: boolean;
}

export function HistoryPageHeader({
  isRefreshing = false,
  isExporting = false,
  onRefresh,
  onExport,
  disableActions = false
}: HistoryPageHeaderProps) {
  return (
    <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">Histórico</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">
          Acompanhe todas as ações realizadas na plataforma.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={disableActions || isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Atualizando..." : "Atualizar"}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={disableActions || isExporting}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className={`h-4 w-4 ${isExporting ? "animate-pulse" : ""}`} />
          {isExporting ? "Exportando..." : "Exportar"}
        </button>
      </div>
    </section>
  );
}
