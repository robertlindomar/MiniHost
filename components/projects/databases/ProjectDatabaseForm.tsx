"use client";

import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { FormLabel } from "@/components/ui/FormLabel";
import { Notice } from "@/components/ui/Notice";
import { MASKED_SECRET_VALUE } from "@/lib/settings";
import type { ProjectDatabase, ProjectDatabaseFormInput, ProjectDatabaseStatus } from "@/lib/types";
import { isValidPostgresIdentifier } from "@/lib/validation";

interface ProjectDatabaseFormProps {
  initialData?: ProjectDatabase;
  suggestions?: Partial<ProjectDatabaseFormInput>;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (input: ProjectDatabaseFormInput) => void | Promise<void>;
  submitLabel: string;
}

const statusOptions: { value: ProjectDatabaseStatus; label: string }[] = [
  { value: "PLANNED", label: "Planejado" },
  { value: "CREATED_MANUALLY", label: "Criado manualmente" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "DISABLED", label: "Desabilitado" }
];

export function ProjectDatabaseForm({
  initialData,
  suggestions,
  isSubmitting = false,
  onCancel,
  onSubmit,
  submitLabel
}: ProjectDatabaseFormProps) {
  const [form, setForm] = useState<ProjectDatabaseFormInput>({
    name: initialData?.name ?? suggestions?.name ?? "",
    databaseName: initialData?.databaseName ?? suggestions?.databaseName ?? "",
    databaseUser: initialData?.databaseUser ?? suggestions?.databaseUser ?? "",
    password: "",
    generatePassword: !initialData,
    host: initialData?.host ?? suggestions?.host ?? "",
    port: initialData?.port ?? suggestions?.port ?? 5432,
    status: initialData?.status ?? "PLANNED",
    notes: initialData?.notes ?? ""
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!initialData && suggestions) {
      setForm((current) => ({
        ...current,
        name: suggestions.name ?? current.name,
        databaseName: suggestions.databaseName ?? current.databaseName,
        databaseUser: suggestions.databaseUser ?? current.databaseUser,
        host: suggestions.host ?? current.host,
        port: suggestions.port ?? current.port
      }));
    }
  }, [initialData, suggestions]);

  function updateField<Key extends keyof ProjectDatabaseFormInput>(key: Key, value: ProjectDatabaseFormInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: string[] = [];
    const databaseName = form.databaseName.trim().toLowerCase();
    const databaseUser = form.databaseUser.trim().toLowerCase();

    if (!form.name.trim()) {
      nextErrors.push("Informe o nome interno do banco.");
    }

    if (!databaseName) {
      nextErrors.push("Informe o database name.");
    } else if (!isValidPostgresIdentifier(databaseName)) {
      nextErrors.push("Database name inválido.");
    }

    if (!databaseUser) {
      nextErrors.push("Informe o usuário do banco.");
    } else if (!isValidPostgresIdentifier(databaseUser)) {
      nextErrors.push("Database user inválido.");
    }

    if (!form.host.trim()) {
      nextErrors.push("Informe o host.");
    }

    if (!Number.isFinite(form.port) || form.port < 1 || form.port > 65535) {
      nextErrors.push("Porta inválida.");
    }

    if (!initialData && !form.generatePassword && (form.password?.trim().length ?? 0) < 16) {
      nextErrors.push("Senha deve ter pelo menos 16 caracteres ou marque gerar automaticamente.");
    }

    setErrors(nextErrors);

    if (nextErrors.length === 0) {
      onSubmit({
        ...form,
        name: form.name.trim(),
        databaseName,
        databaseUser,
        host: form.host.trim(),
        notes: form.notes?.trim() || undefined,
        password: form.generatePassword ? undefined : form.password?.trim()
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.length > 0 ? <Notice type="error" message={errors.join(" ")} /> : null}

      <div>
        <FormLabel htmlFor="db-name" className="text-sm font-medium text-zinc-700">
          Nome interno
        </FormLabel>
        <input
          id="db-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          className={fieldClass}
          placeholder="ex.: Banco principal"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FormLabel htmlFor="db-database-name" className="text-sm font-medium text-zinc-700">
            Database name
          </FormLabel>
          <input
            id="db-database-name"
            value={form.databaseName}
            onChange={(event) => updateField("databaseName", event.target.value.toLowerCase())}
            className={fieldClass}
            placeholder="systagio_db"
          />
        </div>
        <div>
          <FormLabel htmlFor="db-user" className="text-sm font-medium text-zinc-700">
            Database user
          </FormLabel>
          <input
            id="db-user"
            value={form.databaseUser}
            onChange={(event) => updateField("databaseUser", event.target.value.toLowerCase())}
            className={fieldClass}
            placeholder="systagio_user"
          />
        </div>
      </div>

      {!initialData ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <label className="flex items-center gap-3 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              checked={Boolean(form.generatePassword)}
              onChange={(event) => updateField("generatePassword", event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Gerar senha automaticamente
          </label>
          {!form.generatePassword ? (
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              className={fieldClass}
              placeholder="Mínimo 16 caracteres"
            />
          ) : (
            <p className="text-xs text-zinc-500">Uma senha forte será gerada e exibida apenas uma vez após criar.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Senha salva: <span className="font-mono">{MASKED_SECRET_VALUE}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FormLabel htmlFor="db-host" className="text-sm font-medium text-zinc-700">
            Host
          </FormLabel>
          <input
            id="db-host"
            value={form.host}
            onChange={(event) => updateField("host", event.target.value)}
            className={fieldClass}
            placeholder="postgres.exemplo.com"
          />
        </div>
        <div>
          <FormLabel htmlFor="db-port" className="text-sm font-medium text-zinc-700">
            Porta
          </FormLabel>
          <input
            id="db-port"
            type="number"
            value={form.port}
            onChange={(event) => updateField("port", Number(event.target.value))}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="db-status">
          Status
        </label>
        <select
          id="db-status"
          value={form.status}
          onChange={(event) => updateField("status", event.target.value as ProjectDatabaseStatus)}
          className={fieldClass}
          disabled={initialData?.status === "ARCHIVED"}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="db-notes">
          Observações
        </label>
        <textarea
          id="db-notes"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          className={`${fieldClass} min-h-24 resize-y`}
          placeholder="Notas internas sobre este banco"
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
