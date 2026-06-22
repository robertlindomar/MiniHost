import { Suspense } from "react";
import { RecordsPage } from "@/components/pages/RecordsPage";

export default function RecordsRoute() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Carregando registros...</div>}>
      <RecordsPage />
    </Suspense>
  );
}
