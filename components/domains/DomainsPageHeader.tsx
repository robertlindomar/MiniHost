import { Plus } from "lucide-react";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";

interface DomainsPageHeaderProps {
  onCreate: () => void;
  disabled?: boolean;
}

export function DomainsPageHeader({ onCreate, disabled = false }: DomainsPageHeaderProps) {
  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">Domínios cadastrados</h2>
          <FieldInfoTooltip
            label="Domínios"
            description="Cadastre domínios com Zone ID para sincronizar registros DNS com a Cloudflare."
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">
          Gerencie os domínios conectados à MiniHost e sincronizados com a Cloudflare.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Plus className="h-4 w-4" />
        Novo domínio
      </button>
    </section>
  );
}
