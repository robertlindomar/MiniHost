"use client";

import { Save, X } from "lucide-react";
import { useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import type { DnsRecord, DnsRecordFormInput, DnsRecordType, Domain, EntityStatus, TtlValue } from "@/lib/types";
import { validateRecordInput } from "@/lib/validation";
import { Notice } from "@/components/ui/Notice";

interface DnsRecordFormProps {
  domains: Domain[];
  initialData?: DnsRecord;
  onCancel: () => void;
  onSubmit: (input: DnsRecordFormInput) => void;
  submitLabel: string;
}

function getInitialTtlMode(ttl?: TtlValue) {
  return ttl === "auto" || ttl === undefined ? "auto" : "manual";
}

export function DnsRecordForm({ domains, initialData, onCancel, onSubmit, submitLabel }: DnsRecordFormProps) {
  const [form, setForm] = useState({
    domainId: initialData?.domainId ?? domains[0]?.id ?? "",
    type: initialData?.type ?? "A",
    name: initialData?.name ?? "",
    value: initialData?.value ?? "",
    ttlMode: getInitialTtlMode(initialData?.ttl),
    ttlValue: typeof initialData?.ttl === "number" ? String(initialData.ttl) : "3600",
    proxied: initialData?.proxied ?? true,
    status: initialData?.status ?? "active",
    comment: initialData?.comment ?? "",
    priority: typeof initialData?.priority === "number" ? String(initialData.priority) : "10"
  });
  const [errors, setErrors] = useState<string[]>([]);

  function updateField(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildInput(): DnsRecordFormInput {
    const ttl = form.ttlMode === "auto" ? "auto" : Number(form.ttlValue);

    return {
      domainId: form.domainId,
      type: form.type as DnsRecordType,
      name: form.name.trim(),
      value: form.value.trim(),
      ttl,
      proxied: form.proxied,
      status: form.status as EntityStatus,
      comment: form.comment.trim() || undefined,
      priority: form.type === "MX" ? Number(form.priority) : undefined
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = buildInput();
    const nextErrors = validateRecordInput(input);

    if (form.ttlMode === "manual" && form.ttlValue.trim() === "") {
      nextErrors.push("Informe o TTL manual.");
    }

    if (form.type === "MX" && form.priority.trim() === "") {
      nextErrors.push("Informe a prioridade do MX.");
    }

    setErrors(nextErrors);

    if (nextErrors.length === 0) {
      onSubmit(input);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.length > 0 ? <Notice type="error" message={errors.join(" ")} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="record-domain">
            Domínio
          </label>
          <select
            id="record-domain"
            value={form.domainId}
            onChange={(event) => updateField("domainId", event.target.value)}
            className={fieldClass}
          >
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="record-type">
            Tipo do registro
          </label>
          <select
            id="record-type"
            value={form.type}
            onChange={(event) => updateField("type", event.target.value)}
            className={fieldClass}
          >
            <option value="A">A</option>
            <option value="CNAME">CNAME</option>
            <option value="TXT">TXT</option>
            <option value="MX">MX</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="record-name">
            Nome/subdomínio
          </label>
          <input
            id="record-name"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className={fieldClass}
            placeholder="@, www, painel"
          />
        </div>

        {form.type === "MX" ? (
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="record-priority">
              Prioridade
            </label>
            <input
              id="record-priority"
              value={form.priority}
              onChange={(event) => updateField("priority", event.target.value)}
              className={fieldClass}
              inputMode="numeric"
              placeholder="10"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="record-value">
          Valor/conteúdo
        </label>
        <input
          id="record-value"
          value={form.value}
          onChange={(event) => updateField("value", event.target.value)}
          className={fieldClass}
          placeholder={form.type === "A" ? "72.60.250.39" : form.type === "CNAME" ? "robertlindomar.dev" : "Conteúdo do registro"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="record-ttl-mode">
            TTL
          </label>
          <select
            id="record-ttl-mode"
            value={form.ttlMode}
            onChange={(event) => updateField("ttlMode", event.target.value)}
            className={fieldClass}
          >
            <option value="auto">Automático</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {form.ttlMode === "manual" ? (
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="record-ttl-value">
              TTL em segundos
            </label>
            <input
              id="record-ttl-value"
              value={form.ttlValue}
              onChange={(event) => updateField("ttlValue", event.target.value)}
              className={fieldClass}
              inputMode="numeric"
              placeholder="3600"
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
          Proxy ativo
          <input
            type="checkbox"
            checked={form.proxied}
            onChange={(event) => updateField("proxied", event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
        </label>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="record-status">
            Status
          </label>
          <select
            id="record-status"
            value={form.status}
            onChange={(event) => updateField("status", event.target.value)}
            className={fieldClass}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="record-comment">
          Comentário interno opcional
        </label>
        <textarea
          id="record-comment"
          value={form.comment}
          onChange={(event) => updateField("comment", event.target.value)}
          className={`${fieldClass} min-h-24 resize-y`}
          placeholder="Observação local"
        />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <Save className="h-4 w-4" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
