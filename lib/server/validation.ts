import type { DnsRecordFormInput, DomainFormInput, MiniHostSettings, ProjectFormInput } from "@/lib/types";
import { validateSettingsInput } from "@/lib/settings";
import { isDomainLike, isPlausibleZoneId, isValidProjectSlug, validateRecordInput } from "@/lib/validation";

export function validateDomainInput(input: DomainFormInput) {
  const errors: string[] = [];
  const name = input.name?.trim().toLowerCase();
  const provider = input.provider?.trim();

  if (!name) {
    errors.push("Informe o nome do domínio.");
  }

  if (name && /\s/.test(name)) {
    errors.push("Nome do domínio não pode ter espaço.");
  }

  if (name && /^https?:\/\//i.test(name)) {
    errors.push("Informe apenas o domínio, sem http:// ou https://.");
  }

  if (name && !isDomainLike(name)) {
    errors.push("Informe um domínio válido, como exemplo.com.");
  }

  if (!provider) {
    errors.push("Informe o provedor.");
  }

  if (input.status !== "active" && input.status !== "inactive") {
    errors.push("Status inválido.");
  }

  if (input.zoneId && !isPlausibleZoneId(input.zoneId)) {
    errors.push("Zone ID deve ter um formato plausível.");
  }

  return {
    errors,
    data: {
      name,
      provider,
      zoneId: input.zoneId?.trim() || null,
      status: input.status === "inactive" ? "inactive" : "active"
    }
  };
}

export function validateSettingsBody(input: Partial<MiniHostSettings>) {
  const { errors, data } = validateSettingsInput(input);
  const errorList = Object.values(errors);

  return {
    errors: errorList,
    fieldErrors: errors,
    data
  };
}

export function validateDnsRecordBody(input: DnsRecordFormInput) {
  const errors = validateRecordInput(input);

  if (!["A", "AAAA", "CNAME", "TXT", "MX"].includes(input.type)) {
    errors.push("Tipo de registro inválido.");
  }

  const proxied = input.type === "TXT" || input.type === "MX" ? false : Boolean(input.proxied);

  return {
    errors,
    data: {
      domainId: input.domainId,
      projectId: input.projectId?.trim() || null,
      type: input.type,
      name: input.name.trim(),
      content: input.value.trim(),
      ttl: input.ttl === "auto" || input.ttl === 1 ? null : Number(input.ttl),
      proxied,
      status: input.status === "inactive" ? "inactive" : "active",
      comment: input.comment?.trim() || null,
      priority: input.type === "MX" ? Number(input.priority) : null
    }
  };
}

export function validateProjectInput(input: ProjectFormInput) {
  const errors: string[] = [];
  const name = input.name?.trim();
  const slug = input.slug?.trim().toLowerCase();
  const description = input.description?.trim() || null;
  const mainDomain = input.mainDomain?.trim().toLowerCase() || null;
  const validStatuses = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

  if (!name) {
    errors.push("Informe o nome do projeto.");
  }

  if (!slug) {
    errors.push("Informe o slug do projeto.");
  }

  if (slug && !isValidProjectSlug(slug)) {
    errors.push("Slug deve conter apenas letras minúsculas, números e hífen.");
  }

  if (mainDomain && !isDomainLike(mainDomain)) {
    errors.push("Domínio principal deve parecer um domínio válido.");
  }

  if (!validStatuses.includes(input.status)) {
    errors.push("Status do projeto inválido.");
  }

  return {
    errors,
    data: {
      name,
      slug,
      description,
      status: input.status,
      mainDomain
    }
  };
}
