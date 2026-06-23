"use client";

import { AlertTriangle, Cloud, Save, X } from "lucide-react";
import { useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import type { DnsRecord, DnsRecordFormInput, DnsRecordType, Domain, EntityStatus, TtlValue } from "@/lib/types";
import { isSensitiveRecord, validateRecordInput } from "@/lib/validation";
import { Notice } from "@/components/ui/Notice";

interface DnsRecordFormProps {
  domains: Domain[];
  initialData?: DnsRecord;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (input: DnsRecordFormInput) => void | Promise<void>;
  submitLabel: string;
}

function getInitialTtlMode(ttl?: TtlValue) {
  return ttl === "auto" || ttl === undefined ? "auto" : "manual";
}

export function DnsRecordForm({ domains, initialData, isSubmitting = false, onCancel, onSubmit, submitLabel }: DnsRecordFormProps) {
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
    priority: typeof initialData?.priority === "number" ? String(initialData.priority) : "10",
    createInCloudflare: false
  });
  const [errors, setErrors] = useState<string[]>([]);

  function updateField(key: keyof typeof form, value: string | boolean) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "type" && (value === "TXT" || value === "MX")) {
        next.proxied = false;
      }

      return next;
    });
  }

  function buildInput(): DnsRecordFormInput {
    const ttl = form.ttlMode === "auto" ? "auto" : Number(form.ttlValue);
    const proxied = form.type === "TXT" || form.type === "MX" ? false : form.proxied;

    return {
      domainId: form.domainId,
      type: form.type as DnsRecordType,
      name: form.name.trim(),
      value: form.value.trim(),
      ttl,
      proxied,
      status: form.status as EntityStatus,
      comment: form.comment.trim() || undefined,
      priority: form.type === "MX" ? Number(form.priority) : undefined,
      createInCloudflare: !initialData && form.createInCloudflare
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

  const isProxiedDisabled = form.type === "TXT" || form.type === "MX";
  const isEditing = Boolean(initialData);
  const isCloudflareLinked = Boolean(initialData?.cloudflareRecordId);
  const isCloudflareSensitive =
    form.createInCloudflare && isSensitiveRecord({ type: form.type as DnsRecordType, name: form.name.trim() });
  const isEditSensitive = isEditing && initialData ? isSensitiveRecord(initialData) : false;

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
            className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500`}
            disabled={isEditing}
          >
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CNAME">CNAME</option>
            <option value="TXT">TXT</option>
            <option value="MX">MX</option>
          </select>
          {isEditing ? (
            <p className="mt-1 text-xs text-zinc-500">O tipo do registro não pode ser alterado na edição.</p>
          ) : null}
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
          placeholder={
            form.type === "A"
              ? "72.60.250.39"
              : form.type === "AAAA"
                ? "2001:db8::1"
                : form.type === "CNAME"
                  ? "robertlindomar.dev"
                  : "Conteúdo do registro"
          }
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
            checked={!isProxiedDisabled && form.proxied}
            disabled={isProxiedDisabled}
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

      {isProxiedDisabled ? <Notice type="info" message="Registros TXT e MX são criados sem proxy Cloudflare." /> : null}

      {isEditing && !isCloudflareLinked ? (
        <Notice
          type="info"
          message="Este registro não está vinculado à Cloudflare. A edição será apenas local."
        />
      ) : null}

      {isEditing && isCloudflareLinked ? (
        <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Este registro está vinculado à Cloudflare. Ao salvar, você verá um resumo antes de confirmar a alteração real.</p>
        </div>
      ) : null}

      {isEditSensitive ? (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Este registro parece sensível. Revise nome, tipo e conteúdo antes de salvar.</p>
        </div>
      ) : null}

      {!initialData ? (
        <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <label className="flex items-center justify-between gap-4 text-sm font-semibold text-sky-900">
            <span className="inline-flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Criar registro real na Cloudflare
            </span>
            <input
              type="checkbox"
              checked={form.createInCloudflare}
              onChange={(event) => updateField("createInCloudflare", event.target.checked)}
              className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
          </label>
          {form.createInCloudflare ? (
            <div className="flex gap-3 rounded-md border border-sky-200 bg-white/80 p-3 text-sm text-sky-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Essa ação criará um registro DNS real no seu domínio.</p>
            </div>
          ) : null}
          {isCloudflareSensitive ? (
            <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Este registro parece sensível. Revise nome, tipo e conteúdo antes de criar na Cloudflare.</p>
            </div>
          ) : null}
        </div>
      ) : null}

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
