import { Search } from "lucide-react";

interface HistorySearchInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function HistorySearchInput({ value, onChange, disabled = false }: HistorySearchInputProps) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">Buscar histórico</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por ação, entidade, domínio, usuário ou descrição..."
        className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
      />
    </label>
  );
}
