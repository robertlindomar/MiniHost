"use client";

import { Save, X } from "lucide-react";
import { useState } from "react";
import { fieldClass } from "@/components/forms/styles";
import { FormLabel } from "@/components/ui/FormLabel";
import { Notice } from "@/components/ui/Notice";
import type { Project, ProjectFormInput, ProjectStatus } from "@/lib/types";
import { isDomainLike, isValidProjectSlug } from "@/lib/validation";

interface ProjectFormProps {
  initialData?: Project;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (input: ProjectFormInput) => void | Promise<void>;
  submitLabel: string;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "PAUSED", label: "Pausado" }
];

export function ProjectForm({ initialData, isSubmitting = false, onCancel, onSubmit, submitLabel }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectFormInput>({
    name: initialData?.name ?? "",
    slug: initialData?.slug ?? "",
    description: initialData?.description ?? "",
    status: initialData?.status === "ARCHIVED" ? "DRAFT" : (initialData?.status ?? "DRAFT"),
    mainDomain: initialData?.mainDomain ?? ""
  });
  const [errors, setErrors] = useState<string[]>([]);

  function updateField<Key extends keyof ProjectFormInput>(key: Key, value: ProjectFormInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: string[] = [];
    const name = form.name.trim();
    const slug = form.slug.trim().toLowerCase();
    const mainDomain = form.mainDomain?.trim().toLowerCase() ?? "";

    if (!name) {
      nextErrors.push("Informe o nome do projeto.");
    }

    if (!slug) {
      nextErrors.push("Informe o slug do projeto.");
    }

    if (slug && !isValidProjectSlug(slug)) {
      nextErrors.push("Slug deve conter apenas letras minúsculas, números e hífen.");
    }

    if (mainDomain && !isDomainLike(mainDomain)) {
      nextErrors.push("Domínio principal deve parecer um domínio válido.");
    }

    setErrors(nextErrors);

    if (nextErrors.length === 0) {
      onSubmit({
        ...form,
        name,
        slug,
        description: form.description?.trim() || undefined,
        mainDomain: mainDomain || undefined
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.length > 0 ? <Notice type="error" message={errors.join(" ")} /> : null}

      <div>
        <FormLabel htmlFor="project-name" info="Nome exibido na listagem e nos detalhes do projeto." className="text-sm font-medium text-zinc-700">
          Nome do projeto
        </FormLabel>
        <input
          id="project-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          className={fieldClass}
          placeholder="ex.: Systagio"
        />
      </div>

      <div>
        <FormLabel htmlFor="project-slug" info="Identificador único. Use apenas letras minúsculas, números e hífen." className="text-sm font-medium text-zinc-700">
          Slug
        </FormLabel>
        <input
          id="project-slug"
          value={form.slug}
          onChange={(event) => updateField("slug", event.target.value.toLowerCase())}
          className={fieldClass}
          placeholder="ex.: systagio"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="project-description">
          Descrição
        </label>
        <textarea
          id="project-description"
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          className={`${fieldClass} min-h-24 resize-y`}
          placeholder="Breve descrição do sistema ou aplicação"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="project-status">
            Status
          </label>
          <select
            id="project-status"
            value={form.status}
            onChange={(event) => updateField("status", event.target.value as ProjectStatus)}
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
          <FormLabel htmlFor="project-main-domain" info="Domínio principal usado por este projeto." className="text-sm font-medium text-zinc-700">
            Domínio principal
          </FormLabel>
          <input
            id="project-main-domain"
            value={form.mainDomain}
            onChange={(event) => updateField("mainDomain", event.target.value)}
            className={fieldClass}
            placeholder="ex.: systagio.robertlindomar.dev"
          />
        </div>
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
