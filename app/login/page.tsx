import { Suspense } from "react";
import { LoginPage } from "@/components/pages/LoginPage";

export default function LoginRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
      <LoginPage />
    </Suspense>
  );
}
