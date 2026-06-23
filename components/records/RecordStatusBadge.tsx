import type { DnsRecord } from "@/lib/types";

export function RecordStatusBadge({ record }: { record: DnsRecord }) {
  if (record.status === "DELETED") {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        Excluído
      </span>
    );
  }

  if (record.status === "inactive") {
    return (
      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
        Inativo
      </span>
    );
  }

  if (record.cloudflareRecordId) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Sincronizado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      Local
    </span>
  );
}
