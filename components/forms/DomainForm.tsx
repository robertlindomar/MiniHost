"use client";

import { Save, X } from "lucide-react";
import { useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { FormLabel } from "@/components/ui/FormLabel";
import { Notice } from "@/components/ui/Notice";
import type { Domain, DomainFormInput } from "@/lib/types";
import { isDomainLike, isPlausibleZoneId } from "@/lib/validation";

interface DomainFormProps {
  initialData?: Domain;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (input: DomainFormInput) => void | Promise<void>;
  submitLabel: string;
}

export function DomainForm({ initialData, isSubmitting = false, onCancel, onSubmit, submitLabel }: DomainFormProps) {
  const [form, setForm] = useState<DomainFormInput>({
    name: initialData?.name ?? "",
    provider: initialData?.provider ?? "Cloudflare",
    zoneId: initialData?.zoneId ?? "",
    status: initialData?.status ?? "active"
  });
  const [errors, setErrors] = useState<string[]>([]);

  function updateField<Key extends keyof DomainFormInput>(key: Key, value: DomainFormInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: string[] = [];
    const name = form.name.trim().toLowerCase();

    if (!name) {
      nextErrors.push("Informe o nome do domínio.");
    }

    if (/\s/.test(name)) {
      nextErrors.push("Nome do domínio não pode ter espaço.");
    }

    if (/^https?:\/\//i.test(name)) {
      nextErrors.push("Informe apenas o domínio, sem http:// ou https://.");
    }

    if (name && !isDomainLike(name)) {
      nextErrors.push("Informe um domínio válido, como exemplo.com.");
    }

    if (!form.provider.trim()) {
      nextErrors.push("Informe o provedor.");
    }

    if (form.zoneId && !isPlausibleZoneId(form.zoneId)) {
      nextErrors.push("Zone ID deve ter um formato plausível.");
    }

    setErrors(nextErrors);

    if (nextErrors.length === 0) {
      onSubmit({
        ...form,
        name,
        provider: form.provider.trim(),
        zoneId: form.zoneId?.trim()
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.length > 0 ? <Notice type="error" message={errors.join(" ")} /> : null}

      <div>
        <FormLabel htmlFor="domain-name" info="Digite o domínio exatamente como será gerenciado." className="text-sm font-medium text-zinc-700">
          Nome do domínio
        </FormLabel>
        <input
          id="domain-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          className={fieldClass}
          placeholder="ex.: minihost.com.br"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="domain-provider">
            Provedor
          </label>
          <input
            id="domain-provider"
          value={form.provider}
          onChange={(event) => updateField("provider", event.target.value)}
          className={fieldClass}
          placeholder="Cloudflare"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="domain-status">
            Status
          </label>
          <select
            id="domain-status"
            value={form.status}
            onChange={(event) => updateField("status", event.target.value as DomainFormInput["status"])}
            className={fieldClass}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div>
        <FormLabel htmlFor="domain-zone" info="Encontre o Zone ID no painel da Cloudflare." className="text-sm font-medium text-zinc-700">
          Zone ID opcional
        </FormLabel>
        <input
          id="domain-zone"
          value={form.zoneId}
          onChange={(event) => updateField("zoneId", event.target.value)}
          className={fieldClass}
          placeholder="ex.: f4b7d2e8c9a64b16a2d3f5e6b7c8d9e0"
        />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
