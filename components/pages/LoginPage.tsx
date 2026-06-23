"use client";

import { LockKeyhole, LogIn, Server } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { Notice } from "@/components/ui/Notice";
import { apiRequest } from "@/lib/api-client";
import type { SessionUser } from "@/lib/auth/session";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("admin@minihost.local");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);
      await apiRequest<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch {
      setError("Email ou senha inválidos");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-soft">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-semibold text-zinc-950">MiniHost</p>
            <p className="mt-1 text-sm text-zinc-500">Acesso administrativo</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">Entrar no painel</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Use a conta administradora para gerenciar domínios, DNS e configurações.
          </p>
        </div>

        {error ? <Notice type="error" message={error} /> : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
              placeholder="admin@minihost.local"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="login-password">
              Senha
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
              placeholder="Sua senha"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <LockKeyhole className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
