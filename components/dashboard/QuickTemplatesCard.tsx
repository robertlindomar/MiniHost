import { Zap } from "lucide-react";
import { DnsTemplatesPanel } from "@/components/templates/DnsTemplatesPanel";

export function QuickTemplatesCard() {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)] lg:items-center">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Templates rápidos</h2>
            <p className="mt-2 text-sm text-zinc-500">Crie recursos comuns com apenas um clique.</p>
          </div>
        </div>
        <DnsTemplatesPanel mode="quick" />
      </div>
    </section>
  );
}
