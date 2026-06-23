"use client";

import { DnsTemplatesPanel } from "@/components/templates/DnsTemplatesPanel";

export function TemplatesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Templates DNS</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Use modelos prontos para criar registros comuns sem preencher tudo manualmente.
        </p>
      </div>

      <DnsTemplatesPanel />
    </div>
  );
}
