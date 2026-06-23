"use client";

import { Cloud, Lock, Save } from "lucide-react";
import { useState } from "react";
import { AlertBox } from "@/components/settings/AlertBox";
import { FieldInfoTooltip } from "@/components/ui/FieldInfoTooltip";
import { FormLabel } from "@/components/ui/FormLabel";
import type { DnsRecord, DnsRecordFormInput, DnsRecordType, Domain, EntityStatus, TtlValue } from "@/lib/types";
import { validateRecordInput } from "@/lib/validation";

interface DnsRecordFormProps {
  domains: Domain[];
  initialData?: DnsRecord;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (input: DnsRecordFormInput) => void | Promise<void>;
  submitLabel?: string;
}

const fieldClass =
  "mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

function getInitialTtlMode(ttl?: TtlValue) {
  return ttl === "auto" || ttl === undefined ? "auto" : "manual";
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  id
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${checked ? "bg-emerald-500" : "bg-zinc-200"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function DnsRecordForm({
  domains,
  initialData,
  isSubmitting = false,
  onCancel,
  onSubmit,
  submitLabel
}: DnsRecordFormProps) {
  const [form, setForm] = useState({
    domainId: initialData?.domainId ?? domains[0]?.id ?? "",
    type: initialData?.type ?? "A",
    name: initialData?.name ?? "",
    value: initialData?.value ?? "",
    ttlMode: getInitialTtlMode(initialData?.ttl),
    ttlValue: typeof initialData?.ttl === "number" ? String(initialData.ttl) : "300",
    proxied: initialData?.proxied ?? true,
    status: (initialData?.status === "inactive" ? "inactive" : "active") as EntityStatus,
    comment: initialData?.comment ?? "",
    priority: typeof initialData?.priority === "number" ? String(initialData.priority) : "10",
    createInCloudflare: false
  });
  const [errors, setErrors] = useState<string[]>([]);

  const isEditing = Boolean(initialData);
  const isProxiedDisabled = form.type === "TXT" || form.type === "MX";
  const selectedDomain = domains.find((domain) => domain.id === form.domainId);
  const canCreateInCloudflare = Boolean(selectedDomain?.zoneId);

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
    const proxied = isProxiedDisabled ? false : form.proxied;

    return {
      domainId: form.domainId,
      type: form.type as DnsRecordType,
      name: form.name.trim(),
      value: form.value.trim(),
      ttl,
      proxied,
      status: form.status,
      comment: form.comment.trim() || undefined,
      priority: form.type === "MX" ? Number(form.priority) : undefined,
      createInCloudflare: !isEditing && canCreateInCloudflare && form.createInCloudflare
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

  const resolvedSubmitLabel = submitLabel ?? (isEditing ? "Salvar alterações" : "Salvar alterações");

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.length > 0 ? <AlertBox type="error" message={errors.join(" ")} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="record-domain">
            Domínio
          </label>
          <select
            id="record-domain"
            value={form.domainId}
            disabled={isEditing || isSubmitting}
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
          <FormLabel htmlFor="record-type" info={isEditing ? "O tipo não pode ser alterado após a criação do registro." : undefined}>
            Tipo
          </FormLabel>
          <div className="relative">
            <select
              id="record-type"
              value={form.type}
              onChange={(event) => updateField("type", event.target.value)}
              className={`${fieldClass} ${isEditing ? "pr-10" : ""}`}
              disabled={isEditing || isSubmitting}
            >
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="TXT">TXT</option>
              <option value="MX">MX</option>
            </select>
            {isEditing ? (
              <Lock className="pointer-events-none absolute right-3 top-[calc(50%+3px)] h-4 w-4 -translate-y-1/2 text-zinc-400" />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="record-name">
            Nome/subdomínio
          </label>
          <input
            id="record-name"
            value={form.name}
            disabled={isSubmitting}
            onChange={(event) => updateField("name", event.target.value)}
            className={fieldClass}
            placeholder="@"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="record-value">
            Valor/conteúdo
          </label>
          <input
            id="record-value"
            value={form.value}
            disabled={isSubmitting}
            onChange={(event) => updateField("value", event.target.value)}
            className={fieldClass}
            placeholder={form.type === "A" ? "198.51.100.25" : "Conteúdo do registro"}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_100px_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="text-sm font-medium text-zinc-800">TTL</p>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="ttl-mode"
                checked={form.ttlMode === "auto"}
                disabled={isSubmitting}
                onChange={() => updateField("ttlMode", "auto")}
                className="h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              Automático (recomendado)
            </label>
            <span className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="ttl-mode"
                  checked={form.ttlMode === "manual"}
                  disabled={isSubmitting}
                  onChange={() => updateField("ttlMode", "manual")}
                  className="h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                Manual
              </label>
              <FieldInfoTooltip
                label="Sobre TTL manual"
                description="Define um tempo fixo em segundos para o registro. Use Automático para deixar a Cloudflare gerenciar o TTL."
              />
            </span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="record-ttl-value">
            TTL (segundos)
          </label>
          <input
            id="record-ttl-value"
            value={form.ttlValue}
            disabled={isSubmitting || form.ttlMode !== "manual"}
            onChange={(event) => updateField("ttlValue", event.target.value)}
            className={`${fieldClass} disabled:bg-zinc-50 disabled:text-zinc-400`}
            inputMode="numeric"
            placeholder="300"
          />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-sm font-medium text-zinc-900">Proxy ativo</p>
              <FieldInfoTooltip
                label="Proxy ativo"
                description={
                  isProxiedDisabled
                    ? "Registros TXT e MX não podem usar proxy na Cloudflare."
                    : "Ativa o proxy laranja da Cloudflare. Quando desativado, o registro fica em DNS only."
                }
              />
              {form.proxied && !isProxiedDisabled ? <Cloud className="h-3.5 w-3.5 text-orange-500" /> : null}
            </div>
            <ToggleSwitch
              id="record-proxy"
              checked={!isProxiedDisabled && form.proxied}
              disabled={isProxiedDisabled || isSubmitting}
              onChange={(value) => updateField("proxied", value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="record-status">
            Status
          </label>
          <select
            id="record-status"
            value={form.status}
            disabled={isSubmitting}
            onChange={(event) => updateField("status", event.target.value)}
            className={fieldClass}
          >
            <option value="active">● Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="record-priority">
            Prioridade (apenas MX)
          </label>
          <input
            id="record-priority"
            value={form.type === "MX" ? form.priority : "—"}
            disabled={isSubmitting || form.type !== "MX"}
            onChange={(event) => updateField("priority", event.target.value)}
            className={`${fieldClass} disabled:bg-zinc-50 disabled:text-zinc-400`}
            inputMode="numeric"
            placeholder="—"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-800" htmlFor="record-comment">
          Comentário interno (opcional)
        </label>
        <textarea
          id="record-comment"
          value={form.comment}
          disabled={isSubmitting}
          onChange={(event) => updateField("comment", event.target.value)}
          className={`${fieldClass} min-h-24 resize-y`}
          placeholder="Ex.: IP do servidor web principal"
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        {!isEditing ? (
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={canCreateInCloudflare && form.createInCloudflare}
                disabled={!canCreateInCloudflare || isSubmitting}
                onChange={(event) => updateField("createInCloudflare", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              Criar registro real na Cloudflare
            </label>
            <FieldInfoTooltip
              label="Sobre criar registro na Cloudflare"
              description="Se marcado, o registro será publicado na sua zona Cloudflare e passará a valer no DNS público. Se desmarcado, ficará salvo apenas no MiniHost."
            />
          </div>
        ) : (
          <span />
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Salvando..." : resolvedSubmitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
