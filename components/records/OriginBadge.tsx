import { Cloud } from "lucide-react";
import type { DnsRecord } from "@/lib/types";

export function OriginBadge({ source }: { source: DnsRecord["source"] }) {
  if (source === "cloudflare") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
        <Cloud className="h-3.5 w-3.5" />
        Cloudflare
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
      Manual
    </span>
  );
}
