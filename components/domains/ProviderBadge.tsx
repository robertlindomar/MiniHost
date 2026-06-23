import { Cloud } from "lucide-react";

interface ProviderBadgeProps {
  provider: string;
}

export function ProviderBadge({ provider }: ProviderBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
      <Cloud className="h-4 w-4 text-orange-500" />
      {provider || "Cloudflare"}
    </span>
  );
}
