"use client";

import { DnsTemplatesPanel } from "@/components/templates/DnsTemplatesPanel";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";

const TEMPLATES_PAGE_INFO =
  "Templates criam registros DNS com um clique. Requer domínio cadastrado, IP padrão da VPS para registros A e Zone ID para publicar na Cloudflare.";

export function TemplatesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">Templates DNS</h2>
          <FieldInfoTooltip label="Templates DNS" description={TEMPLATES_PAGE_INFO} />
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 md:text-base">
          Use templates prontos para criar registros DNS rapidamente e com segurança.
        </p>
      </div>

      <DnsTemplatesPanel />
    </div>
  );
}
