import { Clock3 } from "lucide-react";

export function HistoryLoadingState() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Clock3 className="h-6 w-6 animate-pulse" />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950">Carregando histórico...</p>
        <p className="mt-1 text-sm text-zinc-500">Buscando eventos registrados na plataforma.</p>
      </div>
      <div className="border-t border-zinc-100 px-5 py-4">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="grid grid-cols-[1fr_1.2fr_1fr_1fr_0.9fr_1.4fr_0.4fr] gap-4">
              <div className="h-6 rounded-full bg-zinc-100" />
              <div className="h-6 rounded-md bg-zinc-100" />
              <div className="h-6 rounded-md bg-zinc-100" />
              <div className="h-6 rounded-md bg-zinc-100" />
              <div className="h-6 rounded-md bg-zinc-100" />
              <div className="h-6 rounded-md bg-zinc-100" />
              <div className="h-6 rounded-md bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
