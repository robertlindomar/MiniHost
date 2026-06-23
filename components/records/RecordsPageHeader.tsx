import { Cloud, RefreshCw } from "lucide-react";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";

interface RecordsPageHeaderProps {
  isLoading?: boolean;
  isSyncing?: boolean;
  canSync?: boolean;
  syncDisabledReason?: string;
  onSync: () => void;
}

const PAGE_INFO =
  "Gerencie registros DNS locais e sincronize com a Cloudflare. Alterações em registros vinculados afetam o DNS público. TXT e MX não usam proxy. Registros de e-mail (MX, SPF, DKIM, DMARC) são sensíveis — edite com cautela.";

export function RecordsPageHeader({
  isLoading = false,
  isSyncing = false,
  canSync = false,
  syncDisabledReason,
  onSync
}: RecordsPageHeaderProps) {
  return (
    <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">Registros DNS</h2>
          <FieldInfoTooltip label="Registros DNS" description={PAGE_INFO} />
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">
          Gerencie todos os registros DNS do seu domínio. Altere, adicione ou remova registros e sincronize com a Cloudflare.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={isLoading || isSyncing || !canSync}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            {isSyncing ? "Sincronizando..." : "Sincronizar com Cloudflare"}
          </button>
          {!canSync && syncDisabledReason ? (
            <FieldInfoTooltip label="Sincronizar com Cloudflare" description={syncDisabledReason} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
