import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        Carregando
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-3 w-full rounded-full bg-zinc-100" />
        <div className="h-3 w-2/3 rounded-full bg-zinc-100" />
      </div>
    </div>
  );
}
