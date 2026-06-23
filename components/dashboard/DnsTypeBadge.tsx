import type { DnsRecordType } from "@/lib/types";

const typeClasses: Record<DnsRecordType, string> = {
  A: "border-blue-100 bg-blue-50 text-blue-700",
  AAAA: "border-indigo-100 bg-indigo-50 text-indigo-700",
  CNAME: "border-emerald-100 bg-emerald-50 text-emerald-700",
  TXT: "border-violet-100 bg-violet-50 text-violet-700",
  MX: "border-amber-100 bg-amber-50 text-amber-700"
};

export function DnsTypeBadge({ type }: { type: DnsRecordType }) {
  return (
    <span className={`inline-flex min-w-12 items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold ${typeClasses[type]}`}>
      {type}
    </span>
  );
}
